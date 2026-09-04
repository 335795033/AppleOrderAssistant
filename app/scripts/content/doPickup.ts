import { IPHONEORDER_CONFIG } from '../../shared/interface'
import {
    sleep,
    randomSleep,
    getElemBySelectorAndText,
    getSelectedStoreInUI,
    waitForClickable,
    isSegmentedSelected,
} from '../../shared/util'
import { storeSearchInPage } from './getStoreCanPickInfo'

/**
 * 判断门店卡片是否“可取货”：
 * 文案含“可取货/有货”且不含否定词（不可取货/无法取货/暂无货/缺货）。
 * 注意“不可取货”包含“可取货”子串，必须先排除否定词。
 */
const isStoreAvailableText = (text: string): boolean => {
    if (!text) return false
    if (/不可取货|无法取货|暂无货|暂无|缺货|无货|不可售|currently unavailable/i.test(text)) return false
    return /可取货|有货|可自提|available/i.test(text)
}

/**
 * 扫描门店列表，找到一个“可取货”且可选的门店卡片。
 * 卡片结构无法 100% 确定，这里做多路兜底：
 *   1. .rf-hcard / [class*="hcard"] 卡片
 *   2. 含 store radio(input[name*="store"]) 的列表项容器
 */
const findAvailableStoreCard = (): { el: HTMLElement; radio: HTMLElement | null; storeName: string } | null => {
    const candidates = Array.from(
        document.querySelectorAll('.rf-hcard, [class*="hcard"], li[class*="store"], div[class*="storecard"], div[class*="store-card"]')
    ) as HTMLElement[]

    for (const card of candidates) {
        if (card.offsetParent === null) continue
        // 排除嵌套：如果卡片内部还有匹配卡片，跳过外层大容器（取最内层）
        const text = (card.textContent || '').trim()
        if (!text) continue

        const radio = card.querySelector('input[type="radio"]') as HTMLInputElement | null
        const name = (card.querySelector('[class*="title"], [class*="name"]')?.textContent || '').trim()

        // 有 radio：以 radio 的 disabled 状态 + 文案共同判断
        if (radio) {
            if (radio.disabled) continue
            if (isStoreAvailableText(text)) {
                return { el: card, radio, storeName: name || text.slice(0, 30) }
            }
            continue
        }

        // 无 radio：纯文案判断（点击卡片本身选中）
        if (isStoreAvailableText(text)) {
            return { el: card, radio: null, storeName: name || text.slice(0, 30) }
        }
    }
    return null
}

/**
 * 查找「继续填写取货详情」按钮（自提模式 fulfillment 页的继续按钮）。
 * 注意区分送货模式的「继续填写送货地址」：按钮文案不同。
 */
const getPickupContinueButton = (): HTMLButtonElement | null => {
    const selectors = [
        '#rs-checkout-continue-button-bottom',
        'button[data-autom="fulfillment-continue-button"]',
        'button[data-autom*="continue-button"]',
        'button[id*="rs-checkout-continue"]',
    ]
    for (const sel of selectors) {
        const btn = document.querySelector(sel) as HTMLButtonElement | null
        if (btn && btn.offsetParent !== null) return btn
    }
    // 文案兜底：明确匹配「取货详情」优先，再退到通用「继续」
    const main = document.querySelector('#checkout-container, [data-autom="checkout-container"], main, [role="main"]')
    const candidates = main ? main.querySelectorAll('button') : document.querySelectorAll('button')
    let generic: HTMLButtonElement | null = null
    for (const btn of Array.from(candidates) as HTMLButtonElement[]) {
        if (btn.offsetParent === null) continue
        const text = (btn.textContent || '').trim()
        if (/取货详情/.test(text)) return btn
        if (!generic && /^继续/.test(text) && !/送货/.test(text)) generic = btn
    }
    return generic
}

/**
 * 自提模式 fulfillment 页处理（UI 驱动，恢复老版本刷库存行为）：
 *   1. 确保“我要取货”tab 选中；
 *   2. 扫描门店列表：
 *      - 已有选中门店 或 发现“可取货”门店 → 选中 → 点「继续填写取货详情」→ 完成；
 *      - 没有 → 强制重新选择省/市/区刷新门店列表（即“一直切换地区”刷库存），
 *        等列表刷新后再扫，循环多轮；
 *   3. 多轮无果 return false，由外层退回 API 轮询(goOrderSteps) 兜底。
 */
export const doPickupFulfillment = async (iPhoneOrderConfig: IPHONEORDER_CONFIG): Promise<boolean> => {
    try {
        // 1) 确保“我要取货”tab 选中
        let iwantpickup = getElemBySelectorAndText('div.rc-segmented-control-text', '我要取货')
        if (!iwantpickup) {
            console.warn(`[三丈apple助手] 自提模式：页面未找到「我要取货」tab`)
            return false
        }
        if (!isSegmentedSelected(iwantpickup)) {
            // 页面刚以 _s=Fulfillment-init 载入，checkout 会话可能尚未同步完成：稍等再点击。
            // 过早/重复点击会触发 selectFulfillmentLocationAction，苹果后端可能返回 541 踢到 404。
            await sleep(1.2 + Math.random() * 1.8, 'wait for checkout session ready before clicking 我要取货')
            iwantpickup.click()
        }
        // 点击后给页面自身的 fulfillmentOptions 请求留处理时间
        await sleep(0.8 + Math.random() * 0.7, 'wait after pickup tab click')

        // 2) 循环扫描门店列表
        const maxRounds = 8
        for (let round = 1; round <= maxRounds; round++) {
            // 2a) 页面已有选中门店（之前选中过/页面自身选中）→ 直接点继续
            const selectedStore = getSelectedStoreInUI()
            if (selectedStore?.storeNumber) {
                console.log(`[三丈apple助手] 取货门店已选中(${selectedStore.storeName})，点击继续填写取货详情`)
                const btn = await waitForClickable(getPickupContinueButton, 3000)
                if (btn) {
                    btn.click()
                    return true
                }
                console.warn(`[三丈apple助手] 门店已选中但未等到「继续填写取货详情」按钮`)
            }

            // 2b) 扫描“可取货”门店卡片
            const card = findAvailableStoreCard()
            if (card) {
                console.log(`[三丈apple助手] 发现可取货门店：${card.storeName}，点击选中`)
                ;(card.radio || card.el).click()
                await sleep(1 + Math.random(), 'wait store selected in UI')
                const btn = await waitForClickable(getPickupContinueButton, 3000)
                if (btn) {
                    console.log(`[三丈apple助手] 点击「继续填写取货详情」`)
                    btn.click()
                    return true
                }
                console.warn(`[三丈apple助手] 选中门店后未等到继续按钮，进入下一轮`)
            } else {
                console.log(`[三丈apple助手] 第 ${round}/${maxRounds} 轮：暂无可取货门店`)
            }

            // 2c) 没有可取货门店 → 强制切地区刷新门店列表（老版本刷库存行为）
            await randomSleep({ min: 0.5, max: 1.5 })
            await storeSearchInPage({ iPhoneOrderConfig, force: true })
            await sleep(
                Math.max(3, iPhoneOrderConfig.stepWait * 0.6) + Math.random() * 2,
                'wait store list refresh after district re-select'
            )
        }
        console.warn(`[三丈apple助手] 自提 UI 驱动 ${maxRounds} 轮未发现可取货门店，转 API 轮询兜底`)
    } catch (e) {
        console.error(`[三丈apple助手] doPickupFulfillment error`, e)
    }
    return false
}
