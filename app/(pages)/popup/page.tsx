'use client'
import { restoreFromStorage, saveToStorage, restoreFromLocalStorage, saveToLocalStorage } from '@/app/shared/util'
import { defaultiPhoneOrderConfig, storeKeys } from '@/app/shared/constants'
import { verifyActivationCode, makeDeviceId } from '@/app/shared/activation'
import { useEffect, useState } from 'react'
import { Match_URL } from '@/app/shared/constants'
import { IPHONEORDER_CONFIG } from '@/app/shared/interface'
import SVGPlay from '@/app/components/SVGPlay'

const Popup = () => {
    const [orderEnabled, setOrderEnable] = useState<boolean>(false)
    const [config, setConfig] = useState<IPHONEORDER_CONFIG>(defaultiPhoneOrderConfig)
    const [activationValidUntil, setActivationValidUntil] = useState<number>(0)
    const [deviceId, setDeviceId] = useState<string>('')
    const [deviceIdCopied, setDeviceIdCopied] = useState<boolean>(false)
    // 异步获取enable状态
    useEffect(() => {
        const getOrderEnable = async () => {
            const isEnabled = await restoreFromStorage(storeKeys.orderEnabled)
            const config = await restoreFromStorage(storeKeys.orderConfig)
            // 激活状态存 local：不随账号同步到其他设备，激活只属于本机
            const validUntil = Number((await restoreFromLocalStorage(storeKeys.activationValidUntil)) || 0)
            // 设备码由硬件指纹实时计算（同机所有浏览器结果一致），无需持久化
            setOrderEnable(!!isEnabled)
            setConfig(config as IPHONEORDER_CONFIG)
            setActivationValidUntil(validUntil)
            setDeviceId(makeDeviceId())
        }
        getOrderEnable()
    }, [])

    const isActivated = activationValidUntil > Date.now()

    const handleOptionClick = () => {
        if (typeof chrome !== 'undefined' && chrome?.runtime) {
            chrome.runtime.openOptionsPage()
        } else {
            console.log(`please open in chrome`)
        }
    }

    const copyDeviceId = async () => {
        if (!deviceId) return
        try {
            await navigator.clipboard.writeText(deviceId)
            setDeviceIdCopied(true)
            setTimeout(() => setDeviceIdCopied(false), 1500)
        } catch (e) {
            console.error(`copy deviceId failed`, e)
        }
    }

    // 开启自动抢购前先做激活码校验：有效期内无需重复验证
    const ensureActivated = async (): Promise<boolean> => {
        if (isActivated) return true
        const code = window.prompt('首次开启自动抢购需要激活。\n请输入激活码（未输入或点取消则不开启）：')
        if (!code) return false
        const result = verifyActivationCode(code, deviceId)
        if (!result.valid || !result.validUntil) {
            window.alert(`激活失败：${result.reason || '激活码无效'}`)
            return false
        }
        await saveToLocalStorage(result.validUntil, storeKeys.activationValidUntil)
        setActivationValidUntil(result.validUntil)
        const dateText = new Date(result.validUntil).toLocaleDateString()
        window.alert(`激活成功，有效期至 ${dateText}`)
        return true
    }

    const handleConfirm = async () => {
        // 开启动作（orderEnabled=true）：先校验激活码（有效期内无需重复验证），再校验配置完整性
        if (orderEnabled) {
            if (!isActivated && !(await ensureActivated())) return
            if (!(
                config?.lastName &&
                config?.mobile &&
                config?.firstName &&
                config?.appleId &&
                config?.last4code &&
                config?.cityName &&
                config?.districtName &&
                config?.provinceName
            )) {
                setOrderEnable(false)
                window.alert(`请先配置必要信息`)
                return
            }
        }
        confirmAsync(orderEnabled)
    }

    const handleTestNotification = () => {
        if (typeof chrome !== 'undefined' && chrome?.tabs) {
            // @ts-ignore
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    data: 'playSystemNotification',
                    voiceInfo: config?.voiceInfo || {},
                })
            })
            // 直接触发 service-worker 响铃
            chrome.runtime.sendMessage({
                data: 'bellring',
                extensionId: chrome.runtime.id,
                voiceInfo: config?.voiceInfo || {},
            })
        }

        console.log(`chrome?.runtime`, chrome?.tabs)
    }

    return (
        <div className="mx-auto mt-1 mb-2 w-[18rem]">
            <main className="flex w-fit flex-col items-center gap-2 justify-between py-3 px-2 mx-auto mb-2 mt-2">
                <div className="flex w-full gap-3 justify-center py-1 mb-2 bg-white border-b border-solid border-slate-300">
                    <div
                        className={`flex w-40 h-9 ${'bg-indigo-600 cursor-pointer'} bg-opacity-90 border border-indigo-500 rounded-md my-2 items-center align-middle justify-center text-center min-w-min px-3 hover:shadow-md hover:bg-indigo-500`}
                        onClick={handleTestNotification}
                    >
                        <SVGPlay className="w-5 h-5 mr-2" />
                        通知测试
                    </div>
                </div>
                <div className="flex flex-row gap-3 h-10 justify-between mb-2 px-4 py-6 rounded-xl bg-slate-100">
                    <div className="flex text-gray-600 items-center text-base font-bold">开启自动抢购</div>
                    <SelectItem
                        enabled={orderEnabled}
                        index={0}
                        callback={({ enabled }) => {
                            setOrderEnable(enabled)
                        }}
                    />
                </div>
                <div className="w-full text-center text-xs text-gray-400 mb-2 -mt-2">
                    {isActivated ? (
                        <span>
                            已激活，有效期至{' '}
                            {new Date(activationValidUntil).toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </span>
                    ) : (
                        <span>未激活：开启自动抢购时需输入激活码</span>
                    )}
                </div>
                <div
                    className="w-full text-center text-xs text-gray-400 -mt-1 cursor-pointer hover:text-gray-600"
                    title="点击复制设备码，发给发码方生成激活码"
                    onClick={copyDeviceId}
                >
                    {deviceIdCopied ? (
                        <span className="text-green-600">设备码已复制</span>
                    ) : (
                        <span>
                            本机设备码：<span className="font-mono tracking-wide">{deviceId || '生成中...'}</span>
                            （点击复制）
                        </span>
                    )}
                </div>
            </main>
            <div className="w-full flex flex-row justify-center text-center items-center gap-5 text-sm">
                <div
                    className={`flex w-1/3 h-9 bg-white text-indigo-500 cursor-pointer bg-opacity-90 border-4 border-t-2 border-indigo-500 rounded-3xl my-2 items-center align-middle justify-center text-center min-w-min px-3 hover:shadow-md hover:border-t-[3px] hover:border-b-[3px]`}
                    onClick={handleOptionClick}
                >
                    配置
                </div>
                <div
                    className={`flex w-1/3 h-9 ${'bg-indigo-600 cursor-pointer'} bg-opacity-90 border border-indigo-500 rounded-3xl my-2 items-center align-middle justify-center text-center min-w-min px-3 hover:shadow-md hover:bg-indigo-500`}
                    onClick={handleConfirm}
                >
                    确认
                </div>
            </div>
        </div>
    )
}

export default Popup

interface ISelectItemProps {
    enabled?: boolean
    index: number
    callback: ({ enabled }: { enabled: boolean }) => void
}
const SelectItem = ({ enabled, callback }: ISelectItemProps) => {
    const handleToggle = () => {
        callback({
            enabled: !enabled,
        })
    }
    return (
        <div className="flex flex-row gap-6">
            <div className="w-20 flex-col justify-center items-end gap-1.5 inline-flex">
                {enabled ? (
                    <div
                        className="w-14 h-7 bg-indigo-600  bg-opacity-70 rounded-2xl  py-0.5 px-[0.2rem] flex relative cursor-pointer ease-linear duration-500 shadow-indigo-500/50 shadow-md"
                        onClick={handleToggle}
                    >
                        <div className="w-6 h-6 bg-gray-100 rounded-full pt-1 pb-2 px-1 ease-linear duration-300 ml-[1.65rem]"></div>
                    </div>
                ) : (
                    <div
                        className="w-14 h-7 bg-slate-400 bg-opacity-50 rounded-2xl py-0.5 px-[0.2rem] flex relative cursor-pointer ease-linear duration-500 shadow-slate-500/50 shadow-md"
                        onClick={handleToggle}
                    >
                        <div className="w-6 h-6 bg-gray-100 rounded-full pt-1 pb-2  px-1 ease-linear duration-300 ml-0"></div>
                    </div>
                )}
            </div>
        </div>
    )
}

interface ICondirmLoadProps {
    callback?: (msg: string) => void
}
const confirmLoad = async ({ callback }: ICondirmLoadProps) => {
    let msg = ``
    if (typeof chrome === 'undefined' || !chrome?.tabs) {
        msg = 'Please use as chrome extension'
        callback && callback(msg)
        return
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabUrl = (tab?.url || '').toLowerCase()
    const urlObj = new URL(tabUrl)
    const isInMatchUrl = urlObj.href.includes(Match_URL)

    if (isInMatchUrl) {
        chrome.tabs.reload(tab.id)
        return
    }
}

const confirmAsync = async (orderEnabled: boolean) => {
    await saveToStorage(orderEnabled, storeKeys.orderEnabled)
    window.close()
}
