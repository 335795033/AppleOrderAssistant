export interface IPHONEORDER_CONFIG {
    lastName?: string
    firstName?: string
    mobile?: string | number
    last4code?: string | number
    appleId?: string
    password?: string
    stepWait: number
    payBill: 'alipay' | 'wechat' | 'ccb' | 'cmb' | 'icbc' | 'huabei'
    payInstallment?: number
    provinceName?: string
    cityName?: string
    districtName?: string
    employeeId?: string
    afterCountThenReload: number
    selfNotiAPI?: string
    voiceInfo: VOICE_OBJ

    // 送货模式相关配置
    deliveryMode?: 'pickup' | 'shipping'
    // 详细地址（街道/小区/门牌号）
    shippingStreet?: string
    // 附加详细地址（楼栋/单元/房间号等）
    shippingStreet2?: string
    // 邮政编码
    shippingPostalCode?: string
    // 发票类型：none 不开发票 / personal 个人 / company 公司 / vat 增值税专用发票
    fapiaoType?: 'none' | 'personal' | 'company' | 'vat'
    // 发票抬头（公司/增值税专用时填写）
    fapiaoTitle?: string
}

export interface VOICE_OBJ {
    text: string
    voiceName?: string
    lang?: string
    times: number
}
