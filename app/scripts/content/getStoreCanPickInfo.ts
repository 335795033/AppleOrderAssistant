import { IPHONEORDER_CONFIG } from '../../shared/interface'
import { applePageUrl, iPhoneModels, fetchHeaders, defaultAres, normalizeDistrictName } from '../../shared/constants'
import { sleep, randomSleep, getSelectedStoreInUI, getStoreCards } from '../../shared/util'
import { rotateSessionAndReload } from './errorRecover'
import crossfetch from 'cross-fetch'
import { each as _each, map as _map } from 'lodash'

const fetch = crossfetch.bind(this)

// 连续请求失败计数：达到阈值后说明当前会话很可能已被苹果风控标记
// (表现为接口 404/403/网络异常)，此时主动轮换会话(清 cookie + 刷新)自愈
let consecutiveFetchFailCount = 0
const MAX_CONSECUTIVE_FAIL = 3

// 从当前在售的最新 Pro 系列中随机取一个真实 SKU，用于被风控时伪装"正常用户浏览"的请求
const getRandomModel4Fake = () => {
    const fakePool = [iPhoneModels.iPhone17Pro, iPhoneModels.iPhone17ProMax, iPhoneModels.iPhone16Pro]
    const models = fakePool[Math.floor(Math.random() * fakePool.length)]
    return models[Math.floor(Math.random() * models.length)]?.model
}

/*
 *   @partNumber iPhone 型号
 *   @isNoWait 是否等待，不等待表示纯粹调用接口
 */
interface IGetStoreCanPickInfoProps {
    x_aos_stk: string
    partNumber: string
    isNoWait?: boolean
    iPhoneOrderConfig: IPHONEORDER_CONFIG
}
const getStoreCanPickInfo = async ({
    x_aos_stk,
    partNumber,
    isNoWait,
    iPhoneOrderConfig,
}: IGetStoreCanPickInfoProps) => {
    // 若页面 UI 已经选中某个门店，直接复用，避免重复调用搜索接口和循环点选区划
    const selectedStore = getSelectedStoreInUI()
    if (selectedStore?.storeNumber) {
        console.log(`[Adzapple助手] 页面 UI 已选中门店，直接使用`, selectedStore)
        return {
            ...selectedStore,
            availableNowForAllLines: true,
        }
    }

    await storeSearchInPage({ iPhoneOrderConfig })
    let pickupStoreInfo: Record<string, any> = {}
    const { host, protocol } = window.location || {}
    // let url = `${protocol}//www.apple.com.cn/shop/fulfillment-messages`
    let url = `/shop/checkoutx?_a=search&_m=checkout.fulfillment.pickupTab.pickup.storeLocator`

    const districtName = normalizeDistrictName(
        iPhoneOrderConfig.provinceName || '',
        iPhoneOrderConfig.cityName || '',
        iPhoneOrderConfig.districtName || defaultAres.districtName
    )
    const provinceName = iPhoneOrderConfig.provinceName || defaultAres.provinceName
    const cityName = iPhoneOrderConfig.cityName || defaultAres.cityName
    let reqQuery = {
        'parts.0': partNumber, // 型号 `MQ8G3CH/A`,
        'mts.0': `regular`,
        pl: true,
        location: `${provinceName} ${cityName} ${districtName}`,
        geoLocated: false,
        state: provinceName,
        city: cityName,
        district: districtName,
    }

    const querystring = _map(reqQuery, (value, key) => {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    }).join(`&`)

    let dataString = '',
        data = []
    const provinceCityDistrict =
        provinceName == cityName ? cityName + ' ' + districtName : provinceName + ' ' + cityName + ' ' + districtName
    data = [
        `checkout.fulfillment.pickupTab.pickup.storeLocator.showAllStores=false`,
        `checkout.fulfillment.pickupTab.pickup.storeLocator.selectStore=`,
        `checkout.fulfillment.pickupTab.pickup.storeLocator.searchInput=${encodeURIComponent(
            provinceName + ' ' + cityName + ' ' + districtName
        )}`,
        `checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.city=${encodeURIComponent(
            cityName
        )}`,
        `checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.state=${encodeURIComponent(
            provinceName
        )}`,
        `checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.provinceCityDistrict=${encodeURIComponent(
            provinceCityDistrict
        )}`,
        `checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.countryCode=CN`,
        `checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.district=${encodeURIComponent(
            districtName
        )}`,
    ]
    dataString = data.join(`&`)

    let options = {
        method: 'POST',
        headers: {
            ...fetchHeaders,
            referer: applePageUrl.buyiPhone,
            'X-Aos-Model-Page': 'checkoutPage',
            'X-Aos-Stk': x_aos_stk,
        },
        credentials: 'include' as RequestCredentials,
        body: dataString,
    }

    console.log(`getStoreCanPickInfo options`, options)
    try {
        let resResult = (await fetch(url, options)) as Record<string, any>

        let pickupResults: any = {}

        // 如果请求失败， 表示被封禁
        if (![200, 301, 302].includes(Number(resResult?.status))) {
            if (!isNoWait) {
                console.log(`********** GMfetch failed, stepWait add 1 sec **********`)
                consecutiveFetchFailCount++
                const resText = await resResult.text()
                // console.log(`resText`, resText)
                iPhoneOrderConfig.stepWait = iPhoneOrderConfig.stepWait + 1
                if (resText?.indexOf(`503 Service Temporarily Unavailable`) > -1) {
                    console.log(`********** and wait 1 min **********`)
                    // 换一个型号调用，让apple认为是正常请求
                    const randomPartNumberiPhonePro = getRandomModel4Fake()
                    await getStoreCanPickInfo({
                        x_aos_stk,
                        partNumber: randomPartNumberiPhonePro,
                        isNoWait: true,
                        iPhoneOrderConfig,
                    })
                    await sleep(60)
                }
                // 连续多次失败(404/403/超时等)：当前会话可能已被风控标记，主动轮换会话自愈
                if (consecutiveFetchFailCount >= MAX_CONSECUTIVE_FAIL) {
                    await rotateSessionAndReload(`checkoutx fetch status ${resResult?.status} consecutive fails`)
                    return {}
                }
            } else {
                console.log(`********** GMfetch failed, NoWait failed **********`)
            }
        } else {
            consecutiveFetchFailCount = 0
            const resJson = await resResult.json()
            console.log(`resJson`, resJson)
            pickupResults =
                resJson?.body?.checkout?.fulfillment?.pickupTab?.pickup?.storeLocator?.searchResults?.d || {}
        }

        let partPickupStores = pickupResults?.retailStores || [],
            pickupNumbers = ''
        _each(partPickupStores, store => {
            const {
                retailAddress,
                storeDisabled,
                pickupMessages,
                availability,
                storeId: storeNumber,
                storeName,
            } = store || {}
            const { availableNowForAllLines } = availability || {}
            const { city, state, province, district, county } = retailAddress || {}
            // 优先按完整行政区过滤；接口缺少某一级字段时，再退回城市过滤，避免把周边城市门店混入结果。
            const sameCity = String(city || '').trim() === String(cityName).trim()
            const sameProvince =
                (!state && !province) ||
                [state, province].some(value => String(value || '').trim() === String(provinceName).trim())
            const sameDistrict =
                (!district && !county) ||
                [district, county].some(value => String(value || '').trim() === String(districtName).trim())
            const isInConfiguredArea = sameCity && sameProvince && sameDistrict
            if (isInConfiguredArea && pickupMessages?.length && (!storeDisabled || availableNowForAllLines)) {
                pickupStoreInfo = {
                    ...pickupStoreInfo,
                    storeNumber,
                    storeName,
                    availableNowForAllLines,
                }
                return false
            }
        })
    } catch (e) {
        console.log(e)
        if (!isNoWait) {
            console.log(`********** GMfetch failed, stepWait add 1 sec, and wait 1 min **********`)
            consecutiveFetchFailCount++
            iPhoneOrderConfig.stepWait = iPhoneOrderConfig.stepWait + 1
            // 换一个型号调用，让apple认为是正常请求
            const randomPartNumberiPhonePro = getRandomModel4Fake()
            await getStoreCanPickInfo({
                x_aos_stk,
                partNumber: randomPartNumberiPhonePro,
                isNoWait: true,
                iPhoneOrderConfig,
            })
            await sleep(10)
            // 连续多次网络异常：当前会话可能已被风控标记，主动轮换会话自愈
            if (consecutiveFetchFailCount >= MAX_CONSECUTIVE_FAIL) {
                await rotateSessionAndReload(`checkoutx fetch network error consecutive fails`)
                return {}
            }
        } else {
            console.log(`********** GMfetch failed, NoWait failed **********`)
        }
    }

    console.log(`pickupStoreInfo`, pickupStoreInfo)
    return pickupStoreInfo
}

export default getStoreCanPickInfo

interface IStoreSearchInPageProps {
    iPhoneOrderConfig: IPHONEORDER_CONFIG
    /**
     * 强制模式：忽略“行政区划已正确就不再点击”的去重逻辑，
     * 每次调用都重新打开下拉并重选省/市/区——用于无可取货门店时
     * 反复刷新门店列表（老版本刷库存行为）
     */
    force?: boolean
}

/**
 * 等待顶部“编辑邮编或城市、区县”按钮文案更新为期望的行政区。
 * 注意直辖市（北京/上海/天津/重庆）按钮只显示 “省 区”两级（如 “重庆 渝中区”），
 * 不存在 “重庆 重庆 渝中区” 这样的重复市级文案，因此用多个候选匹配。
 */
const waitForRegionText = async (candidates: string[], timeoutMs = 5000): Promise<boolean> => {
    const expectedList = candidates.map(c => (c || '').replace(/\s+/g, '')).filter(Boolean)
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        const searchButton = document.querySelector(
            'button[data-autom="fulfillment-pickup-store-search-button"]'
        ) as HTMLElement | null
        const text = (searchButton?.textContent || '').replace(/\s+/g, '')
        if (text && expectedList.some(expected => text.includes(expected))) return true
        await sleep(0.2, 'wait pickup region update')
    }
    return false
}

/**
 * 等待门店列表刷新：列表文案与刷新前不同即认为刷新完成。
 * 若行政区已确认且重选的是同一区（列表内容大概率不变），等一小段后直接放行，
 * 避免每轮固定白等 8 秒。
 */
const waitForStoreListRefresh = async (
    beforeText: string,
    regionConfirmed = false,
    timeoutMs = 8000
): Promise<boolean> => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        const cards = getStoreCards()
        const currentText = Array.from(cards)
            .map(card => card.textContent || '')
            .join('|')
        if (cards.length > 0 && currentText !== beforeText) return true
        if (regionConfirmed && cards.length > 0 && Date.now() - start > 3000) return true
        await sleep(0.2, 'wait pickup store list refresh')
    }
    return false
}

const randomRange = 3
export const storeSearchInPage = async ({ iPhoneOrderConfig, force }: IStoreSearchInPageProps) => {
    const storeSearchDataAutom = `fulfillment-pickup-store-search-button`
    const storeSearchBtn = document.querySelector(`button[data-autom="${storeSearchDataAutom}"]`)
    if (!storeSearchBtn) return

    // 如果页面已经有门店被选中，不要再打开行政区划下拉，避免界面反复抖动
    if (getSelectedStoreInUI()?.storeNumber) return

    const { cityName, provinceName } = iPhoneOrderConfig
    const districtName = normalizeDistrictName(provinceName || '', cityName || '', iPhoneOrderConfig.districtName)

    if (!cityName || !districtName || !provinceName) return

    // 已纠正的情况下，不需要重复点击了（force 模式除外：每轮都重新选择以刷新门店列表）
    if (!force && storeSearchBtn.textContent) {
        if (storeSearchBtn.textContent.includes(districtName) && storeSearchBtn.textContent.includes(provinceName)) {
            return
        }
    }

    const beforeCards = getStoreCards()
    const beforeText = Array.from(beforeCards)
        .map(card => card.textContent || '')
        .join('|')

    await randomSleep({ min: 0, max: randomRange })
    // 用 aria-expanded 判断行政区划下拉是否已展开。
    // 不能用面板里选项的数量判断：下拉收起时省/区两个面板的选项也存在于 DOM（height:0），
    // 旧逻辑会误判为“已展开”，导致从不点开下拉，后续点击全落在隐藏面板上。
    const isSelectionOpen = (storeSearchBtn as HTMLElement).getAttribute('aria-expanded') === 'true'

    if (!isSelectionOpen) {
        ;(storeSearchBtn as HTMLButtonElement).click()
    }

    await randomSleep({ min: 0, max: randomRange })

    const provinceTabBtn = document.getElementById(
        'checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.state'
    )
    provinceTabBtn?.click()

    let hasTheProvince = false
    if (provinceName) {
        const provinceItems = document.querySelectorAll(`li[role="listitem"]>button`)
        _each(provinceItems, p_item => {
            if (p_item?.textContent?.includes(provinceName)) {
                ;(p_item as HTMLButtonElement)?.click()
                hasTheProvince = true
                return false
            }
        })
        await randomSleep({ min: 0, max: randomRange })
    }

    const cityTabBtn = document.getElementById(
        `checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.city`
    )
    cityTabBtn?.click()
    if (hasTheProvince && cityName && cityName != provinceName && cityTabBtn) {
        const cityItems = document.querySelectorAll(`li[role="listitem"]>button`)
        _each(cityItems, p_item => {
            if (p_item?.textContent?.includes(cityName)) {
                ;(p_item as HTMLButtonElement)?.click()
                return false
            }
        })
        await randomSleep({ min: 0, max: randomRange })
    }

    const districtTabBtn = document.getElementById(
        `checkout.fulfillment.pickupTab.pickup.storeLocator.address.stateCitySelectorForCheckout.district`
    )
    districtTabBtn?.click()
    if (districtName && districtTabBtn) {
        const districtItems = Array.from(document.querySelectorAll(`li[role="listitem"]>button`))
        let districtClicked = false
        _each(districtItems, p_item => {
            if (p_item?.textContent?.includes(districtName)) {
                ;(p_item as HTMLButtonElement)?.click()
                districtClicked = true
                return false
            }
        })
        // 兜底：部分省份第二级面板列出的是“市”而非“区县”，找不到区县时退回按城市名匹配
        if (!districtClicked && cityName) {
            _each(districtItems, p_item => {
                if (p_item?.textContent?.includes(cityName)) {
                    ;(p_item as HTMLButtonElement)?.click()
                    return false
                }
            })
        }
        await randomSleep({ min: 0, max: randomRange })
    }

    // 直辖市按钮文案为“省 区”两级（如 “重庆 渝中区”），无重复市级；其余省份为“省 市 区”三级。
    // 多候选匹配，哪种文案都能确认。
    const regionCandidates = [
        `${provinceName}${cityName}${districtName}`,
        `${provinceName}${districtName}`,
        `${cityName}${districtName}`,
    ]
    const regionUpdated = await waitForRegionText(regionCandidates)
    const listUpdated = await waitForStoreListRefresh(beforeText, regionUpdated)
    if (!regionUpdated && !listUpdated) {
        console.warn(`[Adzapple助手] 行政区或门店列表未确认刷新完成`, regionCandidates.join('/'))
    }
}
