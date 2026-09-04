import {
    sleep,
    changeInputValue,
    getElemByID,
    getElemBySelectorAndText,
    restoreFromStorage,
} from '../../shared/util'
import {
    applePageUrl,
    pageElementsId,
    storeKeys,
    prefixBillingoptions,
    iframeMessagePass,
    DELIVERY_MODE,
} from '../../shared/constants'
import type { IPHONEORDER_CONFIG } from '../../shared/interface'
import getPageInitInfo from './getPageInitInfo'
import goOrderSteps from './goOrderSteps'
import doSignIn from './doSignIn'
import { autoRecoverIfErrorPage, getAutoPauseRemainMs } from './errorRecover'
import { doDeliveryFulfillment, doShippingAddressPage } from './doDelivery'
import { doPickupFulfillment } from './doPickup'
import { mapValues as _mapValues } from 'lodash'

// let iPhoneOrderConfig: IPHONEORDER_CONFIG = {
//     lastName: undefined,
//     firstName: undefined,
//     mobile: undefined,
//     last4code: undefined,
//     appleId: undefined, // same as email
//     password: undefined,
//     stepWait: 10,
//     // @ts-ignore
//     payBill: billTypeKeys.alipay,
//     payInstallment: 0,
//     cityName: undefined,
//     districtName: undefined,
//     provinceName: undefined,
//     employeeId: undefined,
// }

const doFroApplePages = async (url?: string) => {
    const orderEnabled = !!(await restoreFromStorage(storeKeys.orderEnabled))
    console.log(`orderEnabled in doForApplePages`, orderEnabled)
    let iframeContainer = document?.getElementById(iframeMessagePass.iframeID) as HTMLIFrameElement
    if (!orderEnabled) {
        if (iframeContainer) {
            iframeContainer.style.display = 'none'
        }
        return
    }

    // ***** 激活码校验（双保险：popup 开启时已验证过，这里防 storage 被绕过/过期后仍在跑） *****
    const activationValidUntil = Number((await restoreFromStorage(storeKeys.activationValidUntil) as any) || 0)
    if (!activationValidUntil || activationValidUntil < Date.now()) {
        console.warn(`[三丈apple助手] 自动抢购未激活或激活已过期，请在扩展弹窗中输入激活码重新开启`)
        if (iframeContainer) iframeContainer.style.display = 'none'
        return
    }

    if (iframeContainer) {
        iframeContainer.style.display = ''
    }

    // ***** 404/风控自愈：如果当前页面是苹果错误页(整页跳 404) *****
    // 先清理被风控标记的会话 cookie 并跳回购物车重建会话，避免无限卡在错误页
    const recovered = await autoRecoverIfErrorPage()
    if (recovered) return

    const iPhoneOrderConfig: IPHONEORDER_CONFIG = await restoreFromStorage(storeKeys.orderConfig)
    await sleep(0.5)

    // ***** 404 自愈刹车 *****
    // 若短时间内已多次“跳404→清cookie→自动再结账”，说明当前会话被风控或该商品/门店
    // 已不可购买，再自动点下去只会反复被踢(还反复掉登录)。此时暂停自动动作，等用户人工确认。
    const pauseRemainMs = await getAutoPauseRemainMs()
    if (pauseRemainMs > 0) {
        console.warn(
            `[三丈apple助手] 检测到频繁 404 自愈，自动下单已暂停 ${Math.ceil(pauseRemainMs / 1000)}s。请人工确认当前机型/取货门店是否可购买；到配置页重新保存可立即解除暂停。`
        )
        return
    }

    let queryString = new URLSearchParams(location.search.toLowerCase())
    let pathname = location.pathname
    console.log(`doFroApplePages`, queryString)

    const { checkout: checkoutElems, shoppingCart: shoppingCartElems } = pageElementsId

    // 登陆态过期，直接去购物车页
    if (/\/shop\/sorry/i.test(pathname)) {
        location.href = applePageUrl.shoppingCart
        return
    }

    // 在购物车页面
    if (/\/shop\/bag/i.test(pathname)) {
        let goCheckoutBtn: HTMLElement | null = getElemByID(shoppingCartElems.checkoutButton)
        if (!goCheckoutBtn && url) {
            location.href = url
            return
        }
        // await sleep(Math.random() * 2)
        goCheckoutBtn?.click()
        return
    }

    // 在登陆页
    // 2024+ 的登录表单由 idmsa appleauth JS 动态渲染。通常登录表单渲染在
    // 嵌套的 signin iframe(origin 多为 idmsa.apple.com.cn，pathname 含 signin 且带 frame_id)
    // 内——借助 manifest all_frames:true，该 iframe 也会运行本 content-script。
    // 判定规则：
    //   - 顶层 /shop/signIn 宿主页自身通常不含表单(表单在其内嵌 iframe)，跳过避免空等；
    //   - 其余命中 /signin 的 frame(含 frame_id 的登录 iframe 等) 交 doSignIn 等待表单出现。
    const isTop = (() => {
        try {
            return window.self === window.top
        } catch (e) {
            return false
        }
    })()
    const hostPageNoForm =
        isTop && /\/signin/i.test(pathname) && !document.querySelector('#signin-container, #signin, form')

    if (/\/signin/i.test(pathname) && !hostPageNoForm) {
        console.log(`doFroApplePages: run doSignIn (top=${isTop}, frame_id=${queryString.get('frame_id')})`, location.href)
        await doSignIn(iPhoneOrderConfig)
        return
    }

    if (/\/shop\/checkout/.test(pathname)) {
        console.log(`I am in checkout steps`)
        // _s 实际值大小写不一（Fulfillment-init / Shipping-init / PickupContact-init 等），
        // 统一转小写，避免各分支 includes 匹配不上
        const s_value = (queryString.get('_s') || '').toLowerCase()
        // 选择门店 / 选择送货方式
        if (s_value.includes('fulfillment')) {
            const isShippingMode = iPhoneOrderConfig.deliveryMode === DELIVERY_MODE.shipping

            if (isShippingMode) {
                // 送货模式：UI 驱动切 tab、填地址、选最近日期、点继续
                const didContinue = await doDeliveryFulfillment(iPhoneOrderConfig)
                if (didContinue) return

                // UI 驱动未成功，兜底刷新等待下次重试
                await sleep(iPhoneOrderConfig.stepWait, 'delivery fulfillment did not continue, wait and retry')
                location.reload()
                return
            }

            // 自提模式：UI 驱动（doPickupFulfillment）——
            //   发现“可取货”门店即选中并点「继续填写取货详情」；
            //   没有可取货门店时反复切换省/市/区刷新门店列表（老版本刷库存行为）；
            //   多轮无果再退回 API 轮询(goOrderSteps) 兜底。
            let iwantpickup = getElemBySelectorAndText('div.rc-segmented-control-text', '我要取货')
            if (!iwantpickup && url) {
                location.href = url
                return
            }
            const didContinue = await doPickupFulfillment(iPhoneOrderConfig)
            if (didContinue) return

            // API 轮询兜底
            let pageInfo = await getPageInitInfo()
            const { partNumber, x_aos_stk } = pageInfo || {}
            console.log(`partNumber, x_aos_stk`, partNumber, x_aos_stk)
            if (!partNumber || !x_aos_stk) {
                // 当前页面没有信息， 则刷新一下
                await sleep(iPhoneOrderConfig.stepWait, 'wait and reload')
                location.reload()
                return
            } else {
                await goOrderSteps({
                    partNumber,
                    x_aos_stk,
                    iPhoneOrderConfig,
                })
            }
        }

        // 填写送货地址 / 联系方式 / 发票 页面
        // 实际 _s 值为 "Shipping-init"（此前假设为 shippingaddress 导致分支永远不命中）
        if (s_value.includes('shipping')) {
            const didContinue = await doShippingAddressPage(iPhoneOrderConfig)
            if (!didContinue) {
                await sleep(iPhoneOrderConfig.stepWait, 'shipping address page did not continue, wait and retry')
                location.reload()
            }
            return
        }

        // 填写取货信息，个人信息 页面
        if (s_value.includes('pickupcontact')) {
            let checkoutSelectPrefix = `checkout.pickupContact.selfPickupContact.selfContact.address`

            let lastNameDom = getElemByID(checkoutElems.pickupContact.lastName) as HTMLInputElement,
                firstNameDom = getElemByID(checkoutElems.pickupContact.firstName) as HTMLInputElement,
                emailAddressDom = getElemByID(checkoutElems.pickupContact.emailAddress) as HTMLInputElement,
                mobileDom = getElemByID(checkoutElems.pickupContact.mobile) as HTMLInputElement,
                last4IdDom = getElemByID(checkoutElems.pickupContact.last4Id) as HTMLInputElement
            // 如果当前dom不存在，说明此时页面还没有加载出来，直接刷新页面加载
            if (!lastNameDom && url) {
                location.href = url
                return
            }
            changeInputValue(lastNameDom, iPhoneOrderConfig.lastName)
            changeInputValue(firstNameDom, iPhoneOrderConfig.firstName)
            changeInputValue(emailAddressDom, iPhoneOrderConfig.appleId)
            changeInputValue(mobileDom, iPhoneOrderConfig.mobile)
            changeInputValue(last4IdDom, iPhoneOrderConfig.last4code)
            getElemByID(checkoutElems.continuebutton)?.click()
            // document.querySelector(`#rs-checkout-continue-button-bottom`).click()
            return
        }

        // 选择付款方式页面
        if (s_value.includes('billing')) {
            const { payBill, payInstallment } = iPhoneOrderConfig || {}
            let alipayBtnInput = getElemByID(checkoutElems.bill.alipay)
            let payBillBtnInput = getElemByID(checkoutElems.bill[payBill])
            if (payBillBtnInput) {
                payBillBtnInput.click()

                if (!['wechat', 'alipay'].includes(payBill)) {
                    // 有分期需求
                    await sleep(1.5)
                    const dataAutom = `${payBillBtnInput.id}-${payInstallment}`.replace(`${prefixBillingoptions}.`, '')
                    const payInstallmentBtnInput = document.querySelector(`input[data-autom="${dataAutom}"]`)
                    console.log(`payInstallmentBtnInput`, payInstallmentBtnInput, `input[data-autom="${dataAutom}"]`)
                    ;(payInstallmentBtnInput as HTMLInputElement)?.click()
                }
            } else if (alipayBtnInput) {
                // 获取不到就走默认的支付宝
                alipayBtnInput.click()
            } else if (url) {
                // 如果没有支付宝，说明页面加载没好，直接刷新
                location.href = url
                return
            }
            getElemByID(checkoutElems.continuebutton)?.click()
            return
        }

        // 结账review页面
        if (s_value.includes('review')) {
            let orderBtn = getElemByID(checkoutElems.continuebutton)
            if (orderBtn) {
                orderBtn.click()
            } else if (url) {
                // 如果既没有去支付按钮，说明页面加载没好，直接刷新
                location.href = url
                return
            }

            return
        }
    }
}

export default doFroApplePages
