import { IPHONEORDER_CONFIG } from '../../shared/interface'
import { pageElementsId, normalizeDistrictName } from '../../shared/constants'
import { sleep, randomSleep, getElemByID, getElemBySelectorAndText, changeInputValue, waitForClickable } from '../../shared/util'

const { checkout: checkoutElems } = pageElementsId

/**
 * 从“选择免费送货方式”中，直接选第一个可选项。
 * （用户要求：不再优先“今天送达”——那个选项会弹出「预定时间快递送货」地址弹窗，
 * 流程复杂；第一个可选项通常是“明天 白天”，无需弹窗，直达下一步。）
 * 真实控件是 fieldset.rs-fulfillment-deliveryoptions 下的单选框：
 *   <input class="form-selector-input" data-autom="fulfillment-option-A8" ...>
 * 注意：绝不能按 [data-autom*="shipping"] 之类宽泛选择器查找——
 * 页面上的 a[data-autom="view-apple-shipping-policy"]（查看 Apple 送货政策，target=_blank）
 * 也会命中，点它会新开帮助页。这里只允许点击 input/label。
 */
const selectNearestDeliverySpeed = async (): Promise<boolean> => {
    try {
        const radios = Array.from(
            document.querySelectorAll(
                [
                    'fieldset.rs-fulfillment-deliveryoptions input[type="radio"]',
                    'input.form-selector-input[name*="shippingOptions"]',
                    'input[data-autom^="fulfillment-option-"]',
                ].join(', ')
            )
        ) as HTMLInputElement[]
        if (!radios.length) {
            console.warn(`[三丈apple助手] 未找到配送速度单选框`)
            return false
        }

        // 取每个 radio 的可读文案：优先 label[for]，其次 aria-label
        const readLabel = (radio: HTMLInputElement): string => {
            const label = document.querySelector(`label[for="${radio.id}"]`)
            return (label?.textContent || radio.getAttribute('aria-label') || '').trim()
        }

        const target = radios.find(r => r.offsetParent !== null)
        if (!target) return false

        const targetText = readLabel(target)
        if (target.checked) {
            console.log(`[三丈apple助手] 配送速度已是第一个可选项：${targetText}`)
            return true
        }
        // 点配套 label（radio 本身可能被样式隐藏，label 与 input 通过 for 关联）
        const targetLabel = document.querySelector(`label[for="${target.id}"]`) as HTMLElement | null
        console.log(`[三丈apple助手] 选择配送速度（第一个可选项）：${targetText}`)
        ;(targetLabel || target).click()
        await randomSleep({ min: 0.3, max: 0.8 })
        return true
    } catch (e) {
        console.error(`[三丈apple助手] selectNearestDeliverySpeed error`, e)
    }
    return false
}

/**
 * 检测「预定时间快递送货」地址弹窗（overlay）是否打开。
 * 弹窗容器 id 为 ts-fulfillment-addressoverlay，内部字段 id 均含 deliveryAddressOverlay。
 */
const getDeliveryOverlay = (): HTMLElement | null => {
    const container =
        (document.querySelector('#ts-fulfillment-addressoverlay') as HTMLElement | null) ||
        (document.querySelector('div[id*="fulfillment-addressoverlay"], div[class*="addressoverlay"]') as HTMLElement | null)
    if (container && container.offsetParent !== null) return container
    // 兜底：弹窗内任意字段可见即认为弹窗打开
    const field = document.querySelector(
        'input[id*="deliveryAddressOverlayaddressStreets"], select[id*="deliveryAddressOverlayaddressSelector"]'
    ) as HTMLElement | null
    return field && field.offsetParent !== null ? field : null
}

/**
 * 填写/确认「预定时间快递送货」地址弹窗。
 * 真实 DOM（用户提供）：
 *   - 保存地址下拉: select[id*="deliveryAddressOverlayaddressSelector.selectAddress"]
 *   - 收货地址(省市区)展示: stateCitySelectorForCheckout 组合框
 *   - 详细地址: input[id$="addressStreets.address.street"]
 *   - 附加详细地址: input[id$="addressStreets.address.street2"]
 *   - 使用按钮: button[data-autom*="Addressapply"]（span 文案“使用”）
 */
const fillDeliveryAddressModal = async (iPhoneOrderConfig: IPHONEORDER_CONFIG): Promise<boolean> => {
    const overlay = getDeliveryOverlay()
    if (!overlay) return false
    console.log(`[三丈apple助手] 检测到「预定时间快递送货」地址弹窗，开始填写`)

    const provinceName = iPhoneOrderConfig.provinceName || ''
    const cityName = iPhoneOrderConfig.cityName || ''
    const districtName = normalizeDistrictName(provinceName, cityName, iPhoneOrderConfig.districtName)
    const street = iPhoneOrderConfig.shippingStreet || ''
    const street2 = iPhoneOrderConfig.shippingStreet2 || ''

    if (!districtName || !street) {
        console.warn(`[三丈apple助手] 送货地址信息不完整，请在配置页填写省/市/区/详细地址`)
        return false
    }

    try {
        // 0) 若存在“保存的地址”下拉且有选项，优先选中第一项（已保存地址最可靠）
        const savedSelect = document.querySelector(
            'select[id*="deliveryAddressOverlayaddressSelector.selectAddress"]'
        ) as HTMLSelectElement | null
        if (savedSelect && savedSelect.offsetParent !== null && savedSelect.options.length > 1 && !savedSelect.value) {
            savedSelect.selectedIndex = 1
            savedSelect.dispatchEvent(new Event('change', { bubbles: true }))
            await randomSleep({ min: 0.3, max: 0.6 })
        }

        // 1) 收货地址（省/市/区）：弹窗头部已展示“重庆 两江新区”时跳过；
        //    不一致时尝试展开 stateCitySelectorForCheckout 并在其中的 select 里选对应项
        const regionTextEl = overlay.querySelector('button span, .rf-form-layout-status, [class*="status"]')
        const regionText = regionTextEl?.textContent || ''
        const regionOK = regionText.includes(districtName) || (regionText.includes('重庆') && districtName.includes('两江新区'))
        if (!regionOK) {
            const selects = Array.from(
                overlay.querySelectorAll(
                    'select[id*="provinceOfDistrict"], select[id*="cityOfDistrict"], select[id*="district"]'
                )
            ) as HTMLSelectElement[]
            const wanted = [
                { key: 'provinceOfDistrict', val: provinceName },
                { key: 'cityOfDistrict', val: cityName },
                { key: 'district', val: districtName },
            ]
            for (const { key, val } of wanted) {
                if (!val) continue
                const sel = selects.find(s => (s.id || '').includes(key) && s.offsetParent !== null)
                if (!sel) continue
                const opt = Array.from(sel.options).find(o => o.textContent?.includes(val))
                if (opt && sel.value !== opt.value) {
                    sel.value = opt.value
                    sel.dispatchEvent(new Event('change', { bubbles: true }))
                    await randomSleep({ min: 0.2, max: 0.4 })
                }
            }
        } else {
            console.log(`[三丈apple助手] 弹窗收货地址已是 ${districtName}，跳过省市区修改`)
        }

        // 2) 详细地址（注意 street2 的 id 也包含 .street，必须用 $= 精确结尾匹配）
        const streetInput = document.querySelector(
            'input[id$="addressStreets.address.street"]:not([id$="street2"])'
        ) as HTMLInputElement | null
        if (streetInput && street && !streetInput.value && !streetInput.disabled) {
            changeInputValue(streetInput, street)
            await randomSleep({ min: 0.2, max: 0.5 })
        }

        // 3) 附加详细地址
        const street2Input = document.querySelector('input[id$="addressStreets.address.street2"]') as HTMLInputElement | null
        if (street2Input && street2 && !street2Input.value && !street2Input.disabled) {
            changeInputValue(street2Input, street2)
            await randomSleep({ min: 0.2, max: 0.5 })
        }

        // 4) 点击“使用”按钮
        const applyBtn =
            (overlay.querySelector('button[data-autom*="Addressapply"], button[data-autom*="apply"]') as HTMLButtonElement | null) ||
            (Array.from(overlay.querySelectorAll('button')).find(
                b => (b.textContent || '').trim() === '使用' && b.offsetParent !== null
            ) as HTMLButtonElement | undefined)
        if (!applyBtn) {
            console.warn(`[三丈apple助手] 弹窗内未找到「使用」按钮`)
            return false
        }
        console.log(`[三丈apple助手] 点击弹窗「使用」按钮`)
        applyBtn.click()

        // 5) 等待弹窗关闭
        for (let i = 0; i < 12; i++) {
            await sleep(0.5, 'wait delivery address overlay close')
            if (!getDeliveryOverlay()) {
                console.log(`[三丈apple助手] 地址弹窗已关闭`)
                return true
            }
        }
        console.warn(`[三丈apple助手] 地址弹窗长时间未关闭`)
        return false
    } catch (e) {
        console.error(`[三丈apple助手] fillDeliveryAddressModal error`, e)
    }
    return false
}

/**
 * 选择送货日期/时段：优先选第一个可用日期+第一个可用时段（即最近可送）
 */
const selectNearestDeliveryDateTime = async (): Promise<boolean> => {
    try {
        // 日期选择器（通常是 radio 或按钮列表）
        const dateOptions = Array.from(
            document.querySelectorAll('[data-autom*="deliveryDate"], [data-autom*="delivery-date"]')
        ) as HTMLElement[]
        if (dateOptions.length) {
            const firstDate = dateOptions.find(el => el.offsetParent !== null)
            if (firstDate) {
                firstDate.click()
                await randomSleep({ min: 0.3, max: 0.7 })
            }
        }

        // 时段选择器
        const timeOptions = Array.from(
            document.querySelectorAll('[data-autom*="deliveryTime"], [data-autom*="delivery-time"]')
        ) as HTMLElement[]
        if (timeOptions.length) {
            const firstTime = timeOptions.find(el => el.offsetParent !== null && !(el as HTMLInputElement).disabled)
            if (firstTime) {
                firstTime.click()
                await randomSleep({ min: 0.3, max: 0.7 })
                return true
            }
        }
    } catch (e) {
        console.error(`[三丈apple助手] selectNearestDeliveryDateTime error`, e)
    }
    return false
}

/**
 * 处理“为我送货”模式的 fulfillment 页面
 * 目标：切到送货 tab → 填地址 → 选最近日期/时段 → 点“继续填写送货地址”
 */
export const doDeliveryFulfillment = async (iPhoneOrderConfig: IPHONEORDER_CONFIG): Promise<boolean> => {
    try {
        // 切到“为我送货”
        const shippingTab = getElemBySelectorAndText('div.rc-segmented-control-text', '为我送货')
        if (shippingTab) {
            // 向上检查是否已选中
            let node: HTMLElement | null = shippingTab
            let isSelected = false
            for (let i = 0; i < 3 && node; i++) {
                if (node.getAttribute?.('aria-selected') === 'true' || /selected|active/i.test(node.className || '')) {
                    isSelected = true
                    break
                }
                node = node.parentElement
            }
            if (!isSelected) {
                shippingTab.click()
                await sleep(1.2 + Math.random() * 1.5, 'wait for shipping tab render')
            }
        }

        // 若弹窗在上次运行时已经打开，先处理掉
        if (getDeliveryOverlay()) {
            await fillDeliveryAddressModal(iPhoneOrderConfig)
        }

        // 选择配送速度（直接选第一个可选项，避开会弹预订弹窗的“今天送达”）
        await selectNearestDeliverySpeed()

        // “今天送达”等选项带 aria-haspopup=dialog，点击后会弹出「预定时间快递送货」
        // 地址弹窗（v2.2 只在点击前检测过一次导致卡死）。这里轮询等待弹窗并填写关闭。
        for (let i = 0; i < 6; i++) {
            if (getDeliveryOverlay()) {
                const filled = await fillDeliveryAddressModal(iPhoneOrderConfig)
                if (!filled) {
                    console.warn(`[三丈apple助手] 地址弹窗处理未成功，稍后重试`)
                    await sleep(1.5, 'wait before overlay retry')
                    continue
                }
            }
            break
        }
        // 弹窗关闭后若配送速度被重置，再补选一次
        await selectNearestDeliverySpeed()

        // 若出现日期/时段选择，选第一个（最近）
        await selectNearestDeliveryDateTime()

        // 点击“继续填写送货地址”
        const continueBtn = (await waitForClickable(getShippingContinueButton, 3000)) as HTMLButtonElement | null
        if (continueBtn) {
            console.log(`[三丈apple助手] 点击继续填写送货地址:`, continueBtn)
            continueBtn.click()
            return true
        }
        console.warn(`[三丈apple助手] 未等到可点击的继续按钮（fulfillment）`)
    } catch (e) {
        console.error(`[三丈apple助手] doDeliveryFulfillment error`, e)
    }
    return false
}

/**
 * 检查送货地址页是否已有默认/已选地址（避免再去点隐藏字段）
 */
const hasSelectedShippingAddress = (): boolean => {
    const selected = document.querySelectorAll(
        `[data-autom*="shippingAddress"] .selected,
        [data-autom*="shippingAddress"].selected,
        .rc-address-card.selected,
        .rc-address-card[data-autom*="selected"],
        [data-autom*="defaultAddress"],
        button[aria-checked="true"]`
    )
    return selected.length > 0
}

/**
 * 多路兜底获取“继续选择付款方式”按钮，避免点到帮助/FAQ 链接
 */
const getShippingContinueButton = (): HTMLButtonElement | null => {
    const selectors = [
        `#${checkoutElems.continuebutton}`,
        'button[data-autom="checkout-container-continue-button"]',
        'button[data-autom*="continue-button"]',
        'button[id*="rs-checkout-continue"]',
        'button.rs-checkout-continue-button',
    ]
    for (const sel of selectors) {
        const btn = document.querySelector(sel) as HTMLButtonElement | null
        if (btn && btn.offsetParent !== null) {
            console.log(`[三丈apple助手] 找到继续按钮(selector=${sel}):`, btn.textContent?.trim())
            return btn
        }
    }
    // 兜底按文案，且只在结账主容器内查找，避免点到帮助链接
    const main = document.querySelector('#checkout-container, [data-autom="checkout-container"], main, [role="main"]')
    const candidates = main ? main.querySelectorAll('button') : document.querySelectorAll('button')
    for (const btn of Array.from(candidates)) {
        // 双重保险：跳过送货政策/帮助区域内的元素（如 a[data-autom="view-apple-shipping-policy"]）
        if (btn.closest('.rs-fulfillment-policylink, [data-autom*="policy"], [class*="policy"]')) continue
        const text = (btn.textContent || '').trim()
        if (/继续选择付款方式|继续填写送货地址|继续|付款方式/.test(text) && (btn as HTMLElement).offsetParent !== null) {
            console.log(`[三丈apple助手] 找到继续按钮(text=${text})`)
            return btn as HTMLButtonElement
        }
    }
    console.warn(`[三丈apple助手] 未找到继续按钮`)
    return null
}

/**
 * 在发票区域内选择发票类型；如果已经是目标类型则不点击，避免误触帮助链接
 */
const selectFapiaoIfNeeded = async (fapiaoType?: string, fapiaoTitle?: string): Promise<void> => {
    if (!fapiaoType || fapiaoType === 'none') return
    const fapiaoMap: Record<string, string> = {
        personal: '电子发票 - 个人',
        company: '电子发票 - 公司/其他',
        vat: '电子发票 - 增值税专用发票',
    }
    const targetLabel = fapiaoMap[fapiaoType]
    if (!targetLabel) return

    const invoiceSection = document.querySelector(
        '[data-autom*="fapiao"], [data-autom*="invoice"], [class*="fapiao"], [class*="invoice"], section[aria-label*="发票"], fieldset[aria-label*="发票"]'
    )
    if (!invoiceSection) {
        console.warn(`[三丈apple助手] 未找到发票区域，跳过发票选择`)
        return
    }

    // 已选中目标类型则不点
    const alreadySelected = Array.from(
        invoiceSection.querySelectorAll('input:checked, .selected, [aria-checked="true"]')
    ).some(el => {
        const text = el.textContent || el.parentElement?.textContent || ''
        return text.includes(targetLabel)
    })
    if (alreadySelected) {
        console.log(`[三丈apple助手] 发票已是目标类型(${targetLabel})，无需点击`)
        return
    }

    const target = Array.from(invoiceSection.querySelectorAll('label, div, button, input')).find(el =>
        el.textContent?.includes(targetLabel)
    ) as HTMLElement | undefined
    if (target) {
        console.log(`[三丈apple助手] 选择发票类型：`, targetLabel)
        target.click()
        await randomSleep({ min: 0.3, max: 0.6 })
    } else {
        console.warn(`[三丈apple助手] 未找到发票选项：`, targetLabel)
    }

    if ((fapiaoType === 'company' || fapiaoType === 'vat') && fapiaoTitle) {
        const titleInput = invoiceSection.querySelector(
            'input[placeholder*="发票抬头"], input[id*="fapiaoTitle"], input[id*="invoiceTitle"]'
        ) as HTMLInputElement | null
        if (titleInput && !titleInput.value) {
            changeInputValue(titleInput, fapiaoTitle)
            await randomSleep({ min: 0.2, max: 0.5 })
        }
    }
}

/**
 * 处理送货地址/联系方式/发票页面
 * 目标：确认地址、填写联系方式、选择发票，然后点“继续选择付款方式”
 */
export const doShippingAddressPage = async (iPhoneOrderConfig: IPHONEORDER_CONFIG): Promise<boolean> => {
    try {
        console.log(`[三丈apple助手] doShippingAddressPage start`)
        const {
            lastName,
            firstName,
            mobile,
            appleId,
            fapiaoType,
            fapiaoTitle,
            shippingStreet,
            shippingStreet2,
            shippingPostalCode,
        } = iPhoneOrderConfig

        // 1) 若页面已有默认/已选地址，跳过隐藏字段填写
        if (hasSelectedShippingAddress()) {
            console.log(`[三丈apple助手] 检测到已有默认/已选送货地址，不再填写隐藏地址字段`)
        } else {
            // 尝试填写可见的地址输入
            const streetInput = getElemByID(checkoutElems.shippingAddress.street) as HTMLInputElement | null
            if (streetInput && !streetInput.value && shippingStreet) {
                changeInputValue(streetInput, shippingStreet)
                await randomSleep({ min: 0.2, max: 0.5 })
            }
            const street2Input = getElemByID(checkoutElems.shippingAddress.street2) as HTMLInputElement | null
            if (street2Input && !street2Input.value && shippingStreet2) {
                changeInputValue(street2Input, shippingStreet2)
                await randomSleep({ min: 0.2, max: 0.5 })
            }
            const postalInput = getElemByID(checkoutElems.shippingAddress.postalCode) as HTMLInputElement | null
            if (postalInput && !postalInput.value && shippingPostalCode) {
                changeInputValue(postalInput, String(shippingPostalCode))
                await randomSleep({ min: 0.2, max: 0.5 })
            }
        }

        // 2) 联系方式（已有值则跳过）
        const lastNameInput = getElemByID(checkoutElems.shippingAddress.lastName) as HTMLInputElement | null
        const firstNameInput = getElemByID(checkoutElems.shippingAddress.firstName) as HTMLInputElement | null
        const emailInput = getElemByID(checkoutElems.shippingAddress.emailAddress) as HTMLInputElement | null
        const mobileInput = getElemByID(checkoutElems.shippingAddress.mobile) as HTMLInputElement | null
        if (lastNameInput && !lastNameInput.value) changeInputValue(lastNameInput, lastName)
        if (firstNameInput && !firstNameInput.value) changeInputValue(firstNameInput, firstName)
        if (emailInput && !emailInput.value) changeInputValue(emailInput, appleId)
        if (mobileInput && !mobileInput.value) changeInputValue(mobileInput, String(mobile || ''))
        await randomSleep({ min: 0.3, max: 0.6 })

        // 3) 发票
        await selectFapiaoIfNeeded(fapiaoType, fapiaoTitle)

        // 4) 点击“继续选择付款方式”
        const continueBtn = (await waitForClickable(getShippingContinueButton, 3000)) as HTMLButtonElement | null
        if (continueBtn) {
            console.log(`[三丈apple助手] 点击继续选择付款方式:`, continueBtn)
            continueBtn.click()
            return true
        }
        console.warn(`[三丈apple助手] 未等到可点击的继续按钮，准备重试/刷新`)
    } catch (e) {
        console.error(`[三丈apple助手] doShippingAddressPage error`, e)
    }
    return false
}
