'use client'
import { restoreFromStorage, saveToStorage, sleep } from '@/app/shared/util'
import {
    storeKeys,
    billItemList,
    defaultiPhoneOrderConfig,
    billTypeKeys,
    defaultPayinstallmentTotal,
    deliveryModeList,
    DELIVERY_MODE,
    fapiaoTypeList,
} from '@/app/shared/constants'
import DropListBox from '@/app/components/DropListBox'
import { IPHONEORDER_CONFIG } from '@/app/shared/interface'
import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { filter as _filter, map as _map, find as _find, findIndex as _findIndex, sortBy as _sortBy } from 'lodash'
import city from '@/app/shared/location/city.json'
import province from '@/app/shared/location/province.json'
import county from '@/app/shared/location/county.json'

const defaultItem = { id: '', name: '' }

type VoiceType = { lang?: string; voiceName?: string; id: string; name: string }

// 旧区名在配置页联动中的兜底：重庆江北区/渝北区已撤销并成立两江新区(2026-01挂牌)，
// 若老配置里存的是旧区名，自动选中“两江新区”，而不是粗暴回退到列表第一个(万州区)。
const resolveDistrictFallback = (
    provinceName?: string,
    districtName?: string,
    newDistrictList?: { id: string; name: string }[]
) => {
    if (!newDistrictList?.length) return ''
    const isChongqing = provinceName === '重庆' || provinceName === '重庆市'
    if (isChongqing && (districtName === '江北区' || districtName === '渝北区')) {
        const liangjiang = _find(newDistrictList, item => item.name === '两江新区')
        if (liangjiang) return liangjiang.name
    }
    return newDistrictList[0].name
}

export default function Options() {
    const [config, setConfig] = useState<IPHONEORDER_CONFIG>(defaultiPhoneOrderConfig)
    const [payinstallmentList, setpayinstallmentList] = useState([defaultItem])
    const [provinceList, setProvinceList] = useState(province)
    const [selectedProvinceIndex, setSelectedProvinceIndex] = useState(0)
    const [cityList, setCityList] = useState([defaultItem])
    const [selectedCityIndex, setSelectedCityIndex] = useState(0)
    const [districtList, setDistrictList] = useState([defaultItem])
    const [selectedDistrictIndex, setSelectedDistrictIndex] = useState(0)
    const [voiceList, setVoiceList] = useState<VoiceType[]>([defaultItem])
    const [helpOpen, setHelpOpen] = useState<boolean>(true)
    const firstNameRef = useRef<HTMLInputElement>(null)
    const lastNameRef = useRef<HTMLInputElement>(null)
    const last4codeRef = useRef<HTMLInputElement>(null)
    const mobileRef = useRef<HTMLInputElement>(null)
    const appleidRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)
    const stepWaitRef = useRef<HTMLInputElement>(null)
    const beforeReloadCountRef = useRef<HTMLInputElement>(null)
    const voiceTimesRef = useRef<HTMLInputElement>(null)
    const voiceTextRef = useRef<HTMLInputElement>(null)
    const notiAPIRef = useRef<HTMLInputElement>(null)
    const shippingStreetRef = useRef<HTMLInputElement>(null)
    const shippingStreet2Ref = useRef<HTMLInputElement>(null)
    const shippingPostalCodeRef = useRef<HTMLInputElement>(null)
    const fapiaoTitleRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        restoreFromStorage(storeKeys.orderConfig).then(data => {
            if (data) {
                console.log(`restoreFromStorage`, data)
                setConfig(config => {
                    return {
                        ...config,
                        ...(data as IPHONEORDER_CONFIG),
                    }
                })
            }
        })

        const syncFun = async () => {
            const voiceList = await getVoices()
            setVoiceList(voiceList)
        }
        syncFun()
    }, [])

    const voiceSelected = useMemo(() => {
        let _index = -1
        const { lang, voiceName } = config?.voiceInfo || {}
        if (lang && voiceName && voiceList.length) {
            _index = _findIndex(voiceList, v => {
                return v.lang == lang && v.voiceName == voiceName
            })
        }
        if (_index < 0) _index = 0
        return _index
    }, [voiceList, config.voiceInfo])
    // ************ 更新选中送货方式 ************
    const deliveryModeSelected = useMemo(() => {
        return (
            _findIndex(deliveryModeList, _b => {
                return _b.id == config.deliveryMode
            }) || 0
        )
    }, [config.deliveryMode])

    // ************ 更新选中支付方式 ************
    const billSelected = useMemo(() => {
        return (
            (config?.payBill &&
                _findIndex(billItemList, _b => {
                    return _b.id == config.payBill
                })) ||
            0
        )
    }, [config.payBill])

    // ************ 更新选中分期笔数 ************
    const payinstallmentSelected = useMemo(() => {
        return (
            (config?.payInstallment &&
                _findIndex(payinstallmentList, _b => {
                    return _b.id == String(config.payInstallment)
                })) ||
            0
        )
    }, [config.payInstallment, payinstallmentList])

    // ************ 👇下拉菜单联动👇 ************
    useEffect(() => {
        const newPayinstallmentList = _map(
            _filter(defaultPayinstallmentTotal, item => {
                if (item.id == 0) return true
                if (item?.includes && Number(item?.includes?.length) > 0) {
                    return item.includes.includes(config.payBill)
                }
                return false
            }),
            (_item: any) => {
                return {
                    id: _item.id,
                    name: _item.name,
                }
            }
        )

        setpayinstallmentList(newPayinstallmentList)
        // 当原来的分期笔数不存在时
        if (
            !_find(newPayinstallmentList, _t => {
                return _t.id == config.payInstallment
            })
        ) {
            setConfig({
                ...config,
                payInstallment: Number(newPayinstallmentList[0].id) || 0,
            })
        }
    }, [config.payBill])

    useEffect(() => {
        if (config.provinceName) {
            let provinceIndex: number = _findIndex(province, item => {
                return item.name == config.provinceName
            })
            provinceIndex = provinceIndex > -1 ? provinceIndex : 0

            setSelectedProvinceIndex(provinceIndex)
            const provinceId = province[provinceIndex].id
            // @ts-ignore
            const newCityList = city[provinceId]
            setCityList(newCityList)
            if (
                !_find(newCityList, _t => {
                    return _t.name == config.cityName
                })
            ) {
                setConfig({
                    ...config,
                    cityName: newCityList[0].name,
                })
            }
            // if (provinceList.length < 1) {
            //     setProvinceList(province)
            // }
        }
    }, [config.provinceName])

    useEffect(() => {
        if (config.cityName) {
            let cityIndex: number = _findIndex(cityList, item => {
                return item.name == config.cityName
            })
            cityIndex = cityIndex > -1 ? cityIndex : 0
            setSelectedCityIndex(cityIndex)
            const cityId: string = cityList[cityIndex].id
            // @ts-ignore
            const newDistrictList = county[cityId]
            // @ts-ignore
            console.log(`cityIndex`, cityIndex, cityList[cityIndex], county[cityId])
            if (newDistrictList) {
                setDistrictList(newDistrictList)
                if (
                    !_find(newDistrictList, _t => {
                        return _t.name == config.districtName
                    })
                ) {
                    setConfig({
                        ...config,
                        districtName: resolveDistrictFallback(config.provinceName, config.districtName, newDistrictList),
                    })
                }
            }
        }
    }, [config.cityName, cityList])

    useEffect(() => {
        // setSelectedDistrictIndex
        let districtIndex: number = _findIndex(districtList, item => {
            return item.name == config.districtName
        })
        districtIndex = districtIndex > -1 ? districtIndex : 0
        setSelectedDistrictIndex(districtIndex)
    }, [config.districtName, districtList])
    // ************ 👆下拉菜单联动👆 ************

    // ************ 送货方式 ************
    const handleSelectDeliveryMode = (deliveryItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                deliveryMode: deliveryItem.id,
            }
        })
    }

    // ************ 支付方式 ************
    const handleSelectPayType = (payItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                payBill: payItem.id,
            }
        })
    }

    // ************ 分期笔数 ************
    const handleSelectPayinstallment = (payinstallmentItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                payInstallment: payinstallmentItem.id,
            }
        })
    }

    // ************ 选中省份 ************
    const handleSelectProvince = (provinceItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                provinceName: provinceItem.name,
            }
        })
    }
    // ************ 选中城市 ************
    const handleSelectCity = (cityItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                cityName: cityItem.name,
            }
        })
    }

    // ************ 选中区域 ************
    const handleSelectDistrict = (districtItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                districtName: districtItem.name,
            }
        })
    }

    const fapiaoTypeSelected = useMemo(() => {
        return (
            _findIndex(fapiaoTypeList, _b => {
                return _b.id == config.fapiaoType
            }) || 0
        )
    }, [config.fapiaoType])

    const handleSelectFapiaoType = (fapiaoItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                fapiaoType: fapiaoItem.id,
            }
        })
    }

    const handleSelectVoice = (voiceItem: Record<string, any>) => {
        setConfig(prev => {
            return {
                ...prev,
                voiceInfo: {
                    ...prev.voiceInfo,
                    lang: voiceItem.lang,
                    voiceName: voiceItem.voiceName,
                },
            }
        })
    }
    const handleSave = useCallback(() => {
        const saveConfig: IPHONEORDER_CONFIG = {
            ...config,
            firstName: firstNameRef.current?.value,
            lastName: lastNameRef.current?.value,
            last4code: last4codeRef.current?.value,
            mobile: mobileRef.current?.value,
            appleId: appleidRef.current?.value,
            password: passwordRef.current?.value,
            stepWait: Number(stepWaitRef.current?.value) || config.stepWait || 10,
            afterCountThenReload: Number(beforeReloadCountRef.current?.value) || config.afterCountThenReload || 50,
            selfNotiAPI: notiAPIRef.current?.value || '',
            voiceInfo: {
                ...config.voiceInfo,
                text: voiceTextRef.current?.value || defaultiPhoneOrderConfig.voiceInfo.text,
                voiceName: config.voiceInfo.voiceName || '',
                lang: config.voiceInfo.lang || '',
                times: Number(voiceTimesRef.current?.value) || defaultiPhoneOrderConfig.voiceInfo.times,
            },
            shippingStreet: shippingStreetRef.current?.value,
            shippingStreet2: shippingStreet2Ref.current?.value,
            shippingPostalCode: shippingPostalCodeRef.current?.value,
            fapiaoTitle: fapiaoTitleRef.current?.value,
        }
        console.log(saveConfig)
        saveAsync(saveConfig)
    }, [config])

    const handleCancel = useCallback(() => {
        window.close()
    }, [])

    const handlePlaySound = () => {
        const _text = voiceTextRef.current?.value || defaultiPhoneOrderConfig.voiceInfo.text,
            _voiceName = config.voiceInfo.voiceName || '',
            _lang = config.voiceInfo.lang || ''
        let voiceOptions = {}
        if (config.voiceInfo.voiceName && config.voiceInfo.lang) {
            voiceOptions = {
                lang: config.voiceInfo.lang,
                voiceName: config.voiceInfo.voiceName,
            }
        }
        if (typeof chrome !== 'undefined' && chrome?.tts) {
            chrome.tts.speak(_text, voiceOptions)
        }
    }

    const inputClass = `px-3 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6`
    const labelClass = `block text-sm font-medium leading-6 text-gray-900`
    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
            <div className="space-y-12">
                {/* ************ 使用说明 ************ */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-6 py-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold leading-7 text-gray-900">使用说明</h2>
                        <button
                            type="button"
                            className="rounded-md bg-white px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-300 hover:bg-indigo-100"
                            onClick={() => setHelpOpen(!helpOpen)}
                        >
                            {helpOpen ? '收起' : '展开'}
                        </button>
                    </div>
                    {helpOpen && (
                        <div className="mt-4 space-y-5 text-sm leading-6 text-gray-700">
                            <div>
                                <h4 className="font-semibold text-gray-900">一、快速上手</h4>
                                <ol className="mt-1 list-decimal space-y-1 pl-5">
                                    <li>
                                        在本页填好个人信息与省/市/区（自提时选方便取货的城市；选「为我送货」还需在下方填详细地址与发票信息），然后点击右下角「保存」。
                                    </li>
                                    <li>
                                        用同一浏览器登录 apple.com.cn。到开抢时间后，<b>需要你自己把想抢的机型加入购物袋</b>——
                                        加购动作必须手动点击完成，扩展不会替你抢「加入购物袋」这一步，只负责加购之后的结账流程。
                                    </li>
                                    <li>
                                        加购成功后停留在购物袋页面，点击工具栏扩展图标打开弹窗，再点「确认」开启自动抢购。
                                    </li>
                                    <li>
                                        扩展会自动走完 选门店/送货→填地址→填发票→选择付款方式 的流程，直到付款确认页由你人工付款。
                                    </li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900">二、两种模式怎么跑</h4>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    <li>
                                        <b>我要取货（刷库存）：</b>
                                        自动在当前城市挑选「可取货」门店并进入下一步；若所选区域无可取货门店，会自动循环切换省/市/区刷新门店列表，
                                        一旦出现可取货门店立即选中继续（老版刷库存行为）。全部区域都无货时转入后台轮询继续盯。
                                    </li>
                                    <li>
                                        <b>为我送货（快递配送）：</b>
                                        进入结账后自动选择<b>第一个可选的配送时段</b>（不选「今天送达」，以避开需要另选「预定时间快递送货」的弹窗）；
                                        随后自动填好收货地址、联系方式并点击「继续选择付款方式」，发票类型与抬头按下方配置自动选择。
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900">三、常见问题与提醒</h4>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    <li>
                                        <b>遇 404 或反复被踢出登录：</b>说明当前会话被风控标记。扩展会自动清理 cookie 并跳回购物车重建会话；
                                        若短时间内多次触发，会自动暂停自动下单以免继续被踢，到本页重新点一次「保存」即可解除暂停。
                                    </li>
                                    <li>
                                        <b>建议用无痕窗口运行：</b>普通窗口里长期登录的会话更容易被风控，出现问题时换无痕窗口重试往往就好了。
                                    </li>
                                    <li>
                                        <b>登录密码务必填写：</b>不填密码时下单流程需要接收手机短信验证码，无法全自动完成。
                                    </li>
                                    <li>
                                        <b>StepWait 默认 10 秒：</b>步频等待时间不要设得太短，过快的请求会触发苹果风控/封 IP。
                                    </li>
                                    <li>
                                        登录信息与收货地址均保存在浏览器本地扩展存储中，请勿把配置页截图转发给他人。
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900">四、抢到后的提醒</h4>
                                <p className="mt-1">
                                    抢到进入付款页后，扩展会按「系统设置」中的配置循环播报提示音；还可在「实验性功能」中填入一个支持 GET 触发的推送接口
                                    （如 Bark / Server酱 的推送 URL），成功后会自动请求该地址通知你。
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-b border-gray-900/10 pb-12">
                    <h2 className="text-base font-semibold leading-7 text-gray-900">配置信息</h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600">以下信息用于抢购iPhone时自动填入</p>
                    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label htmlFor="last-name" className={labelClass}>
                                姓氏
                            </label>
                            <div className="mt-2">
                                <input
                                    ref={lastNameRef}
                                    type="text"
                                    name="last-name"
                                    id="last-name"
                                    autoComplete="family-name"
                                    className={inputClass}
                                    defaultValue={config.lastName}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="first-name" className={labelClass}>
                                名字
                            </label>
                            <div className="mt-2">
                                <input
                                    ref={firstNameRef}
                                    type="text"
                                    name="first-name"
                                    id="first-name"
                                    autoComplete="given-name"
                                    className={inputClass}
                                    defaultValue={config.firstName}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="mobile-number" className={labelClass}>
                                手机号
                            </label>
                            <div className="mt-2">
                                <input
                                    type="tel"
                                    ref={mobileRef}
                                    name="mobile-number"
                                    id="mobile-number"
                                    className={inputClass}
                                    defaultValue={config.mobile}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="last-code" className={labelClass}>
                                身份证后四位
                            </label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    ref={last4codeRef}
                                    name="last-code"
                                    id="last-code"
                                    className={inputClass}
                                    defaultValue={config.last4code}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="email" className={labelClass}>
                                邮箱/Apple ID
                            </label>
                            <div className="mt-2">
                                <input
                                    ref={appleidRef}
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    className={inputClass}
                                    defaultValue={config.appleId}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="password" className={labelClass}>
                                登录密码 (请填写，否则需要手机号接验证码，无法完成整个流程)
                            </label>
                            <div className="mt-2">
                                <input
                                    ref={passwordRef}
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="password"
                                    className={inputClass}
                                    defaultValue={config.password}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="pay-type" className={labelClass}>
                                支付方式
                            </label>
                            <div className="mt-2">
                                <DropListBox
                                    itemList={billItemList}
                                    domID={'pay-type'}
                                    selectedIndex={billSelected}
                                    callback={handleSelectPayType}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="pay-installment" className={labelClass}>
                                分期笔数
                            </label>
                            <div className="mt-2">
                                <DropListBox
                                    itemList={payinstallmentList}
                                    domID={'pay-installment'}
                                    selectedIndex={payinstallmentSelected}
                                    callback={handleSelectPayinstallment}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2 sm:col-start-1">
                            <label htmlFor="province-list" className={labelClass}>
                                省份
                            </label>
                            <div className="mt-2">
                                <DropListBox
                                    itemList={provinceList}
                                    selectedIndex={selectedProvinceIndex}
                                    domID={'province-list'}
                                    callback={handleSelectProvince}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label htmlFor="city-list" className={labelClass}>
                                城市
                            </label>
                            <div className="mt-2">
                                <DropListBox
                                    itemList={cityList}
                                    domID={'city-list'}
                                    callback={handleSelectCity}
                                    selectedIndex={selectedCityIndex}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label htmlFor="district-list" className={labelClass}>
                                区名
                            </label>
                            <div className="mt-2">
                                <DropListBox
                                    itemList={districtList}
                                    selectedIndex={selectedDistrictIndex}
                                    domID={'district-list'}
                                    callback={handleSelectDistrict}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-b border-gray-900/10 pb-12">
                    <h2 className="text-base font-semibold leading-7 text-gray-900">送货配置</h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                        选择“为我送货”时，省/市/区使用上方配置；下方填写收货详细地址与发票信息。
                    </p>
                    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label htmlFor="delivery-mode" className={labelClass}>
                                送货方式
                            </label>
                            <div className="mt-2">
                                <DropListBox
                                    itemList={deliveryModeList}
                                    domID={'delivery-mode'}
                                    selectedIndex={deliveryModeSelected}
                                    callback={handleSelectDeliveryMode}
                                />
                            </div>
                        </div>

                        {config.deliveryMode === DELIVERY_MODE.shipping && (
                            <>
                                <div className="sm:col-span-3">
                                    <label htmlFor="shipping-street" className={labelClass}>
                                        详细地址（街道/小区/门牌号）
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            ref={shippingStreetRef}
                                            type="text"
                                            name="shipping-street"
                                            id="shipping-street"
                                            className={inputClass}
                                            defaultValue={config.shippingStreet}
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-3">
                                    <label htmlFor="shipping-street2" className={labelClass}>
                                        附加详细地址（楼栋/单元/房间号）
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            ref={shippingStreet2Ref}
                                            type="text"
                                            name="shipping-street2"
                                            id="shipping-street2"
                                            className={inputClass}
                                            defaultValue={config.shippingStreet2}
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-3">
                                    <label htmlFor="shipping-postal-code" className={labelClass}>
                                        邮政编码
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            ref={shippingPostalCodeRef}
                                            type="text"
                                            name="shipping-postal-code"
                                            id="shipping-postal-code"
                                            className={inputClass}
                                            defaultValue={config.shippingPostalCode}
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-3">
                                    <label htmlFor="fapiao-type" className={labelClass}>
                                        发票类型
                                    </label>
                                    <div className="mt-2">
                                        <DropListBox
                                            itemList={fapiaoTypeList}
                                            domID={'fapiao-type'}
                                            selectedIndex={fapiaoTypeSelected}
                                            callback={handleSelectFapiaoType}
                                        />
                                    </div>
                                </div>

                                {(config.fapiaoType === 'company' || config.fapiaoType === 'vat') && (
                                    <div className="sm:col-span-3">
                                        <label htmlFor="fapiao-title" className={labelClass}>
                                            发票抬头
                                        </label>
                                        <div className="mt-2">
                                            <input
                                                ref={fapiaoTitleRef}
                                                type="text"
                                                name="fapiao-title"
                                                id="fapiao-title"
                                                className={inputClass}
                                                defaultValue={config.fapiaoTitle}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="border-b border-gray-900/10 pb-12">
                    <h2 className="text-base font-semibold leading-7 text-gray-900">系统设置</h2>
                    <h4 className="text-sm font-medium leading-7 text-gray-900">
                        如果你不了解以下配置应该如何设置，保持默认值即可。
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-gray-600"></p>
                    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label htmlFor="step-wait" className={labelClass}>
                                StepWait (步频等待秒数。默认10秒，不建议设置过短，会封IP)
                            </label>
                            <div className="mt-2">
                                <input
                                    ref={stepWaitRef}
                                    id={'step-wait'}
                                    min={1}
                                    max={20}
                                    step={0.5}
                                    type="number"
                                    defaultValue={config.stepWait}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <div className="sm:col-span-3">
                            <label htmlFor="beforereload-count" className={labelClass}>
                                每周期重试次数 (默认50，后台请求达到该次数才会刷新页面，防止签名过期)
                            </label>
                            <div className="mt-2">
                                <input
                                    ref={beforeReloadCountRef}
                                    id={'beforereload-count'}
                                    min={1}
                                    max={100}
                                    step={1}
                                    type="number"
                                    defaultValue={config.afterCountThenReload}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label htmlFor="voice-list" className={labelClass}>
                                提示音声音
                            </label>
                            <div className="mt-2">
                                <DropListBox
                                    itemList={voiceList}
                                    selectedIndex={voiceSelected}
                                    domID={'voice-list'}
                                    callback={handleSelectVoice}
                                />
                            </div>
                        </div>
                        <div className="sm:col-span-3">
                            <label htmlFor="voice-times" className={labelClass}>
                                播放次数
                            </label>
                            <div className="mt-2">
                                <input
                                    ref={voiceTimesRef}
                                    id="voice-times"
                                    name="voice-times"
                                    type="number"
                                    min={1}
                                    max={15}
                                    step={1}
                                    className={inputClass}
                                    defaultValue={config.voiceInfo.times}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-5">
                            <label htmlFor="voice-text" className={labelClass}>
                                提示音文本
                            </label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    ref={voiceTextRef}
                                    name="voice-text"
                                    id="voice-text"
                                    className={inputClass}
                                    defaultValue={config.voiceInfo.text || ''}
                                />
                            </div>
                        </div>
                        <div className="sm:col-span-1 align-bottom flex items-end justify-end">
                            <div className="flex w-1/2 items-end justify-end">
                                <button
                                    type="submit"
                                    className="rounded-md w-full bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                    onClick={handlePlaySound}
                                >
                                    播放
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-b border-gray-900/10 pb-12">
                    <h2 className="text-base font-semibold leading-7 text-gray-900">实验性功能</h2>
                    <h4 className="text-sm font-medium leading-7 text-gray-900">
                        如果你不了解以下配置的功能，可以忽略它们。
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-gray-600"></p>
                    <div className="mt-10 space-y-10">
                        <div className="sm:col-span-6">
                            <label htmlFor="noti-api" className={labelClass}>
                                自定义消息API (由于跨域限制，仅支持GET请求，将以图片 src 方式引入并调用)
                            </label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    ref={notiAPIRef}
                                    name="noti-api"
                                    id="noti-api"
                                    className={inputClass}
                                    defaultValue={config.selfNotiAPI || ''}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* <div className="border-b border-gray-900/10 pb-12">
                    <h2 className="text-base font-semibold leading-7 text-gray-900">Notifications</h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600"></p>

                    <div className="mt-10 space-y-10">
                        <fieldset>
                            <legend className="text-sm font-semibold leading-6 text-gray-900">By Email</legend>
                            <div className="mt-6 space-y-6">
                                <div className="relative flex gap-x-3">
                                    <div className="flex h-6 items-center">
                                        <input
                                            id="comments"
                                            name="comments"
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                        />
                                    </div>
                                    <div className="text-sm leading-6">
                                        <label htmlFor="comments" className="font-medium text-gray-900">
                                            Comments
                                        </label>
                                        <p className="text-gray-500">
                                            Get notified when someones posts a comment on a posting.
                                        </p>
                                    </div>
                                </div>
                                
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend className="text-sm font-semibold leading-6 text-gray-900">
                                Push Notifications
                            </legend>
                            <p className="mt-1 text-sm leading-6 text-gray-600">
                                These are delivered via SMS to your mobile phone.
                            </p>
                            <div className="mt-6 space-y-6">
                                <div className="flex items-center gap-x-3">
                                    <input
                                        id="push-everything"
                                        name="push-notifications"
                                        type="radio"
                                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                    />
                                    <label htmlFor="push-everything" className={labelClass}>
                                        Everything
                                    </label>
                                </div>
                                
                            </div>
                        </fieldset>
                    </div>
                </div> */}
            </div>

            <div className="mt-6 flex items-center justify-end gap-x-6">
                <button type="button" className="text-sm font-semibold leading-6 text-gray-900" onClick={handleCancel}>
                    取消
                </button>
                <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    onClick={handleSave}
                >
                    保存
                </button>
            </div>
        </main>
    )
}

const saveAsync = async (config: IPHONEORDER_CONFIG) => {
    await saveToStorage(config, storeKeys.orderConfig)
    await sleep(1)
    window.close()
}

const validateVoices = ['zh-cn', 'zh-tw', 'zh-hk', 'en-us', 'en-gb']
const getVoices = async (): Promise<VoiceType[]> => {
    let voiceList: VoiceType[] = [defaultItem]
    if (typeof chrome !== 'undefined' && chrome?.tts) {
        return new Promise((resolve, reject) => {
            chrome.tts.getVoices(
                // @ts-ignore
                function (voices) {
                    voiceList = []
                    _map(voices, v => {
                        const { lang, voiceName } = v || {}
                        const prefixlang = lang && lang.toLowerCase()
                        if (validateVoices.includes(prefixlang)) {
                            voiceList.push({
                                lang: lang,
                                voiceName: voiceName,
                                name: `${lang} - ${voiceName}`,
                                id: `${lang} - ${voiceName}`,
                            })
                        }
                    })
                    voiceList = _sortBy(voiceList, function (o) {
                        const x = !o?.lang ? 9999 : validateVoices.indexOf(o.lang.toLowerCase())
                        return x
                    })
                    resolve(voiceList)
                }
            )
        })
    }

    return voiceList
}
