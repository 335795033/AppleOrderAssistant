import { mapValues as _mapValues } from 'lodash'
import { IPHONEORDER_CONFIG } from './interface'

/*
 * 机型/颜色/容量 数据表
 * 用途：仅在接口被苹果风控(503/异常)时，随机挑选一个真实在售型号发一次请求，
 *       让服务端认为当前是"正常用户在浏览"。
 * 真实抢购的 partNumber 不依赖此表 —— 插件会从你购物车中的第一件商品自动读取。
 *
 * 2026-09-02 更新：
 *   - 新增 iPhone 17 / 17 Pro / 17 Pro Max（数据抓取自 apple.com.cn 在售商品页，真实官方 SKU）
 *   - 说明：iPhone 18 系列正式发布后，把苹果官网出现的
 *     「型号代码(如 MGxxxCH/A)」按下方格式追加新机型数组即可（此表不参与核心抢购逻辑，
 *     加入购物车的任意新款都会被自动识别并抢购）。
 */
export const iPhoneModels = {
    iPhone16Pro: [
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '128GB', model: 'MYLN3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '256GB', model: 'MYLT3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '512GB', model: 'MYLX3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '1TB', model: 'MYM53CH/A' },

        { color: { value: 'white', text: '白色钛金属' }, capacity: '128GB', model: 'MYLP3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '256GB', model: 'MYLU3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '512GB', model: 'MYLY3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '1TB', model: 'MYM63CH/A' },

        { color: { value: 'desert', text: '沙漠色钛金属' }, capacity: '128GB', model: 'MYLQ3CH/A' },
        { color: { value: 'desert', text: '沙漠色钛金属' }, capacity: '256GB', model: 'MYLV3CH/A' },
        { color: { value: 'desert', text: '沙漠色钛金属' }, capacity: '512GB', model: 'MYM23CH/A' },
        { color: { value: 'desert', text: '沙漠色钛金属' }, capacity: '1TB', model: 'MYM73CH/A' },

        { color: { value: 'primary', text: '原色钛金属' }, capacity: '128GB', model: 'MYLR3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '256GB', model: 'MYLW3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '512GB', model: 'MYM43CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '1TB', model: 'MYM83CH/A' },
    ],
    iPhone16ProMax: [
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '256GB', model: 'MYTM3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '512GB', model: 'MYTR3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '1TB', model: 'MYTY3CH/A' },

        { color: { value: 'white', text: '白色钛金属' }, capacity: '256GB', model: 'MYTN3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '512GB', model: 'MYTT3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '1TB', model: 'MYW03CH/A' },

        { color: { value: 'desert', text: '沙漠色钛金属' }, capacity: '256GB', model: 'MYTP3CH/A' },
        { color: { value: 'desert', text: '沙漠色钛金属' }, capacity: '512GB', model: 'MYTW3CH/A' },
        { color: { value: 'desert', text: '沙漠色钛金属' }, capacity: '1TB', model: 'MYW13CH/A' },

        { color: { value: 'primary', text: '原色钛金属' }, capacity: '256GB', model: 'MYTQ3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '512GB', model: 'MYTX3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '1TB', model: 'MYW23CH/A' },
    ],

    // ********** 👇iPhone 17 系列 (2025.09 发布, 官网在售, 2026-09 抓取)👇 **********
    iPhone17: [
        { color: { value: 'black', text: '黑色' }, capacity: '256GB', model: 'MG6W4CH/A' },
        { color: { value: 'black', text: '黑色' }, capacity: '512GB', model: 'MG724CH/A' },

        { color: { value: 'white', text: '白色' }, capacity: '256GB', model: 'MG6X4CH/A' },
        { color: { value: 'white', text: '白色' }, capacity: '512GB', model: 'MG734CH/A' },

        { color: { value: 'mistblue', text: '薄雾蓝' }, capacity: '256GB', model: 'MG6Y4CH/A' },
        { color: { value: 'mistblue', text: '薄雾蓝' }, capacity: '512GB', model: 'MG744CH/A' },

        { color: { value: 'sage', text: '鼠尾草绿' }, capacity: '256GB', model: 'MG714CH/A' },
        { color: { value: 'sage', text: '鼠尾草绿' }, capacity: '512GB', model: 'MG764CH/A' },

        { color: { value: 'lavender', text: '薰衣草紫' }, capacity: '256GB', model: 'MG704CH/A' },
        { color: { value: 'lavender', text: '薰衣草紫' }, capacity: '512GB', model: 'MG754CH/A' },
    ],

    iPhone17Pro: [
        { color: { value: 'silver', text: '银色' }, capacity: '256GB', model: 'MG8T4CH/A' },
        { color: { value: 'silver', text: '银色' }, capacity: '512GB', model: 'MG8W4CH/A' },
        { color: { value: 'silver', text: '银色' }, capacity: '1TB', model: 'MG904CH/A' },

        { color: { value: 'orange', text: '宇宙橙' }, capacity: '256GB', model: 'MG8U4CH/A' },
        { color: { value: 'orange', text: '宇宙橙' }, capacity: '512GB', model: 'MG8X4CH/A' },
        { color: { value: 'orange', text: '宇宙橙' }, capacity: '1TB', model: 'MG914CH/A' },

        { color: { value: 'blue', text: '深蓝' }, capacity: '256GB', model: 'MG8V4CH/A' },
        { color: { value: 'blue', text: '深蓝' }, capacity: '512GB', model: 'MG8Y4CH/A' },
        { color: { value: 'blue', text: '深蓝' }, capacity: '1TB', model: 'MG924CH/A' },
    ],

    iPhone17ProMax: [
        { color: { value: 'silver', text: '银色' }, capacity: '256GB', model: 'MG034CH/A' },
        { color: { value: 'silver', text: '银色' }, capacity: '512GB', model: 'MG064CH/A' },
        { color: { value: 'silver', text: '银色' }, capacity: '1TB', model: 'MG094CH/A' },
        { color: { value: 'silver', text: '银色' }, capacity: '2TB', model: 'MG0F4CH/A' },

        { color: { value: 'orange', text: '宇宙橙' }, capacity: '256GB', model: 'MG044CH/A' },
        { color: { value: 'orange', text: '宇宙橙' }, capacity: '512GB', model: 'MG074CH/A' },
        { color: { value: 'orange', text: '宇宙橙' }, capacity: '1TB', model: 'MG0A4CH/A' },
        { color: { value: 'orange', text: '宇宙橙' }, capacity: '2TB', model: 'MG0G4CH/A' },

        { color: { value: 'blue', text: '深蓝' }, capacity: '256GB', model: 'MG054CH/A' },
        { color: { value: 'blue', text: '深蓝' }, capacity: '512GB', model: 'MG084CH/A' },
        { color: { value: 'blue', text: '深蓝' }, capacity: '1TB', model: 'MG0E4CH/A' },
        { color: { value: 'blue', text: '深蓝' }, capacity: '2TB', model: 'MG0Q4CH/A' },
    ],
    // ********** 👆iPhone 17 系列👆 **********

    iPhone15Pro: [
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '128GB', model: 'MTQ43CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '256GB', model: 'MTQ83CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '512GB', model: 'MTQD3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '1TB', model: 'MTQH3CH/A' },

        { color: { value: 'white', text: '白色钛金属' }, capacity: '128GB', model: 'MTQ53CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '256GB', model: 'MTQ93CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '512GB', model: 'MTQE3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '1TB', model: 'MTQJ3CH/A' },

        { color: { value: 'blue', text: '蓝色钛金属' }, capacity: '128GB', model: 'MTQ73CH/A' },
        { color: { value: 'blue', text: '蓝色钛金属' }, capacity: '256GB', model: 'MTQC3CH/A' },
        { color: { value: 'blue', text: '蓝色钛金属' }, capacity: '512GB', model: 'MTQG3CH/A' },
        { color: { value: 'blue', text: '蓝色钛金属' }, capacity: '1TB', model: 'MTQL3CH/A' },

        { color: { value: 'primary', text: '原色钛金属' }, capacity: '128GB', model: 'MTQ63CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '256GB', model: 'MTQA3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '512GB', model: 'MTQF3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '1TB', model: 'MTQK3CH/A' },
    ],

    iPhone15ProMax: [
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '256GB', model: 'MU2N3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '512GB', model: 'MU2T3CH/A' },
        { color: { value: 'black', text: '黑色钛金属' }, capacity: '1TB', model: 'MU2X3CH/A' },

        { color: { value: 'white', text: '白色钛金属' }, capacity: '256GB', model: 'MU2P3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '512GB', model: 'MU2U3CH/A' },
        { color: { value: 'white', text: '白色钛金属' }, capacity: '1TB', model: 'MU2Y3CH/A' },

        { color: { value: 'blue', text: '蓝色钛金属' }, capacity: '256GB', model: 'MU2R3CH/A' },
        { color: { value: 'blue', text: '蓝色钛金属' }, capacity: '512GB', model: 'MU2W3CH/A' },
        { color: { value: 'blue', text: '蓝色钛金属' }, capacity: '1TB', model: 'MU613CH/A' },

        { color: { value: 'primary', text: '原色钛金属' }, capacity: '256GB', model: 'MU2Q3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '512GB', model: 'MU2V3CH/A' },
        { color: { value: 'primary', text: '原色钛金属' }, capacity: '1TB', model: 'MU603CH/A' },
    ],
}

// keys
export enum storeKeys {
    orderEnabled = `orderEnabled`,
    orderConfig = `orderConfig`,
    /** 激活码验证通过后写入的过期时间戳(ms)，存在 chrome.storage.local（不随账号同步，激活状态只属于本机） */
    activationValidUntil = `activationValidUntil`,
}

// 激活码内置密钥：用于校验激活码签名（与本地生成器 activation-generator.html 保持一致）
// 激活码格式：IPO-<YYYYMMDD>-<16位设备码>-<8位随机盐>-<32位SHA-256签名>，到期日为当天 23:59:59
export const ACTIVATION_SECRET = 'SZzh@ng-Apple#2026#vN8wK2xQ7mR4tL9pZ3fJ6bH5cY1dG0sA'

export const applePageUrl = {
    shoppingCart: `https://www.apple.com.cn/shop/bag`,
    buyiPhone: `https://www.apple.com.cn/shop/buy-iphone`,
    shoppingCartWithoutHost: `/shop/bag`,
    buyiPhoneWithoutHost: `/shop/buy-iphone`,
}

export const Match_URL = `apple.com.cn`

// ********** 👇page Element👇 **********
const prefixCheckout = `checkout`
const prefixPickupContact = `${prefixCheckout}.pickupContact`
const prefixSelfPickupContact = `${prefixPickupContact}.selfPickupContact`
const prefixSelfContact = `${prefixSelfPickupContact}.selfContact`
const prefixAddressCheckout = `${prefixSelfContact}.address`

const prefixNationalIdSelf = `${prefixSelfPickupContact}.nationalIdSelf`

const prefixBill = `${prefixCheckout}.billing`
export const prefixBillingoptions = `${prefixBill}.billingoptions`

export const pageElementsId = {
    shoppingCart: {
        checkoutButton: `shoppingCart.actions.navCheckout`,
    },
    signIn: {
        appleIdInput: `signIn.customerLogin.appleId`,
        applePasswordInput: `signIn.customerLogin.password`,
        loginSubmitButton: `signin-submit-button`,
        guestLoginButon: `signIn.guestLogin.guestLogin`,
        dataHandleByAppleCheckbox: `signIn.consentOverlay.dataHandleByApple`,
        dataOutSideMyCountryCheckbox: `signIn.consentOverlay.dataOutSideMyCountry`,
        acceptButton: `consent-overlay-accept-button`,
    },
    checkout: {
        continuebutton: `rs-checkout-continue-button-bottom`,
        fulfillment: {
            selectPickupButton: `fulfillmentOptionButtonGroup1`,
        },
        pickupContact: {
            lastName: `${prefixAddressCheckout}.lastName`,
            firstName: `${prefixAddressCheckout}.firstName`,
            emailAddress: `${prefixAddressCheckout}.emailAddress`,
            mobile: `${prefixAddressCheckout}.fullDaytimePhone`,
            last4Id: `${prefixNationalIdSelf}.nationalIdSelf`,
        },
        // 送货地址页
        shippingAddress: {
            lastName: `checkout.shippingAddress.selfShippingAddress.address.lastName`,
            firstName: `checkout.shippingAddress.selfShippingAddress.address.firstName`,
            emailAddress: `checkout.shippingAddress.selfShippingAddress.address.emailAddress`,
            mobile: `checkout.shippingAddress.selfShippingAddress.address.fullDaytimePhone`,
            street: `checkout.shippingAddress.selfShippingAddress.address.street`,
            street2: `checkout.shippingAddress.selfShippingAddress.address.street2`,
            district: `checkout.shippingAddress.selfShippingAddress.address.district`,
            city: `checkout.shippingAddress.selfShippingAddress.address.city`,
            state: `checkout.shippingAddress.selfShippingAddress.address.state`,
            postalCode: `checkout.shippingAddress.selfShippingAddress.address.postalCode`,
        },
        bill: {
            alipay: `${prefixBillingoptions}.alipay`,
            wechat: `${prefixBillingoptions}.wechat`,
            huabei: `${prefixBillingoptions}.installments0001243254`,
            cmb: `${prefixBillingoptions}.installments0001321713`,
            ccb: `${prefixBillingoptions}.installments0000882476`,
            icbc: `${prefixBillingoptions}.installments0000833448`,
        },
    },
}

// ********** 👆page Element👆 **********

// 付款方式
export enum BILL_OPTIONS_TYPE {
    alipay = `支付宝`,
    wechat = `微信`,
    ccb = `建设银行`,
    cmb = `招商银行`,
    icbc = `工商银行`,
    huabei = `花呗`,
}

export const billTypeKeys = _mapValues(BILL_OPTIONS_TYPE, (v, k) => {
    return k
})
export const billItemList = [
    {
        id: billTypeKeys.alipay,
        name: BILL_OPTIONS_TYPE.alipay,
    },
    {
        id: billTypeKeys.wechat,
        name: BILL_OPTIONS_TYPE.wechat,
    },
    {
        id: billTypeKeys.ccb,
        name: BILL_OPTIONS_TYPE.ccb,
    },
    {
        id: billTypeKeys.cmb,
        name: BILL_OPTIONS_TYPE.cmb,
    },
    {
        id: billTypeKeys.icbc,
        name: BILL_OPTIONS_TYPE.icbc,
    },
    {
        id: billTypeKeys.huabei,
        name: BILL_OPTIONS_TYPE.huabei,
    },
]

// 送货方式
export enum DELIVERY_MODE {
    pickup = 'pickup',
    shipping = 'shipping',
}

export const deliveryModeList = [
    { id: DELIVERY_MODE.pickup, name: '我要取货（门店自提）' },
    { id: DELIVERY_MODE.shipping, name: '为我送货（快递配送）' },
]

export const fapiaoTypeList = [
    { id: 'none', name: '不开发票' },
    { id: 'personal', name: '电子发票 - 个人' },
    { id: 'company', name: '电子发票 - 公司/其他' },
    { id: 'vat', name: '电子发票 - 增值税专用发票' },
]

export const defaultiPhoneOrderConfig: IPHONEORDER_CONFIG = {
    stepWait: 10,
    // @ts-ignore
    payBill: billTypeKeys.alipay,

    // 轮询到该次数后不再原地刷新，而是先轮换会话(清除被风控标记的 cookie)再刷新页面。
    // 默认 20 次(约每 3~5 分钟)轮换一次，可明显降低长时间高频刷库存接口导致被苹果
    // 风控、页面跳到 404 的概率。若仍遇到 404，可在配置页调大 stepWait(如 15~20)。
    afterCountThenReload: 20,

    voiceInfo: {
        text: `抢到了`,
        times: 3,
    },

    // 默认自提模式，保持老用户行为不变
    deliveryMode: DELIVERY_MODE.pickup,
    fapiaoType: 'none',
}

export const defaultPayinstallmentTotal = [
    {
        id: 0,
        name: '不分期',
    },
    {
        id: 3,
        name: '3期',
        includes: [billTypeKeys.ccb, billTypeKeys.cmb, billTypeKeys.huabei, billTypeKeys.icbc],
    },
    {
        id: 6,
        name: '6期',
        includes: [billTypeKeys.ccb, billTypeKeys.cmb, billTypeKeys.huabei, billTypeKeys.icbc],
    },
    {
        id: 12,
        name: '12期',
        includes: [billTypeKeys.ccb, billTypeKeys.cmb, billTypeKeys.huabei, billTypeKeys.icbc],
    },
    {
        id: 24,
        name: '24期',
        includes: [billTypeKeys.ccb, billTypeKeys.cmb, billTypeKeys.icbc],
    },
]

export const commonHeaders = {
    accept: '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    // "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
    referer: applePageUrl.buyiPhone,
    // cookie: document.cookie,
}

export const fetchHeaders = {
    ...commonHeaders,
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded',
    // 'Content-Type': 'application/x-www-form-urlencoded',
    Modelversion: 'v2',
    pragma: 'no-cache',
    syntax: 'graviton',
    // "x-aos-model-page": "checkoutPage",
    // "x-aos-stk": x_aos_stk,
    'X-Requested-With': 'Fetch',
}

export const defaultAres = {
    cityName: `上海`,
    provinceName: `上海`,
    districtName: `闵行区`,
}

/*
 * 行政区划更名兼容映射
 * 背景：2025-11 国务院批复撤销重庆江北区、渝北区，设立两江新区（2026-01 挂牌）。
 *       苹果官网取货门店地址也已改用“两江新区”。
 * 旧配置里保存的 江北区/渝北区 在运行时自动归一化为 两江新区，
 * 避免用户在重新打开配置页保存前，插件仍用已失效的区名去请求苹果导致 404。
 */
export const normalizeDistrictName = (provinceName: string, _cityName: string, districtName?: string): string => {
    if (!districtName) return districtName || ''
    const isChongqing = provinceName === '重庆' || provinceName === '重庆市'
    if (isChongqing && (districtName === '江北区' || districtName === '渝北区')) {
        return '两江新区'
    }
    return districtName
}

export const CHECKOUT_STEPS = {
    selectStore: `?_a=select&_m=checkout.fulfillment.pickupTab.pickup.storeLocator`,
    selectPickupTime: `?_a=continueFromFulfillmentToPickupContact&_m=checkout.fulfillment`,
    checkoutFulfillment: `?_a=continueFromFulfillmentToPickupContact&_m=checkout.fulfillment`,
    pickupContact: `?_a=continueFromPickupContactToBilling&_m=checkout.pickupContact`,
    // 送货模式：选择快递配送并提交地址/时间
    selectShipping: `?_a=continueFromFulfillmentToShippingAddress&_m=checkout.fulfillment`,
    shippingAddress: `?_a=continueFromShippingAddressToBilling&_m=checkout.shippingAddress`,
    selectBill: `/billing?_a=selectBillingOptionAction&_m=checkout.billing.billingOptions`,
    checkoutBill: `/billing?_a=continueFromBillingToReview&_m=checkout.billing`,
    placeOrder: `?_a=continueFromReviewToProcess&_m=checkout.review.placeOrder`,
}

export const iframeMessagePass = {
    iframeID: 'tips_iframe',
    messageAction: 'updateFetchCount',
}
