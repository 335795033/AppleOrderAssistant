export const sleep = async (sec: number | string, markText?: string) => {
    console.log(`sleep seconds:`, sec, markText || '')
    return new Promise((resolve, reject) => {
        setTimeout(
            () => {
                resolve(true)
            },
            Number(sec) * 1000
        )
    })
}

interface IRandomSleepProps {
    min?: number
    max: number
    markText?: string
}
export const randomSleep = async ({ min, max, markText }: IRandomSleepProps) => {
    console.log(`sleep seconds =>`, `min: ${min}`, `max: ${max}`, markText || '')
    const sec = (min || 0) + Math.random() * max
    return new Promise((resolve, reject) => {
        setTimeout(
            () => {
                resolve(true)
            },
            Number(sec) * 1000
        )
    })
}

export const changeInputValue = (inputDom?: HTMLInputElement, newText?: any) => {
    if (!inputDom) return
    let lastvalue = inputDom.value
    inputDom.value = newText
    let event = new Event('input', { bubbles: true })
    event.simulated = true
    let tracker = inputDom._valueTracker
    if (tracker) {
        tracker.setValue(lastvalue)
    }
    inputDom.dispatchEvent(event)
}

export const getElemByID = (idname: string) => {
    if (!idname) return null
    return document.getElementById(idname) || document.querySelector(`#${idname}`) || null
}

export const getElemBySelectorAndText = (selector: string, text: string) => {
    const allElems = Array.from(document.querySelectorAll(selector))
    if (allElems.length) {
        const ele = allElems.find(elem => {
            return (elem as HTMLElement).textContent?.includes(text)
        })
        return ele as HTMLElement | undefined
    }
    return null
}

/**
 * 等待某个元素变为可点击状态（存在、可见、非 disabled/aria-disabled）
 * getter 可以是选择器字符串、元素、或返回元素的函数（函数形式可在轮询中重新查询 DOM）
 */
export const waitForClickable = async (
    getter: (() => HTMLElement | null) | string | HTMLElement | null,
    timeout = 3000
): Promise<HTMLElement | null> => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        let el: HTMLElement | null = null
        if (typeof getter === 'function') {
            el = getter()
        } else if (typeof getter === 'string') {
            el = document.querySelector(getter) as HTMLElement | null
        } else {
            el = getter
        }
        if (
            el &&
            !el.hasAttribute('disabled') &&
            el.getAttribute('aria-disabled') !== 'true' &&
            el.offsetParent !== null
        ) {
            return el
        }
        await sleep(0.1)
    }
    return null
}

/**
 * 判断苹果分段控件(送货/我要取货)是否已处于选中态：向上找 3 层，命中 aria-selected/selected/active 即认为已选中
 */
export const isSegmentedSelected = (el: HTMLElement | null | undefined): boolean => {
    let node: HTMLElement | null = el || null
    for (let i = 0; i < 3 && node; i++) {
        if (node.getAttribute?.('aria-selected') === 'true') return true
        if (/selected|active/i.test(node.className || '')) return true
        node = node.parentElement
    }
    return false
}

/**
 * 苹果 checkout 取货门店卡片选择器。
 * 新版结账页（rt-storelocator）门店卡片结构：
 *   div.form-selector
 *     ├─ input.form-selector-input[type=radio][name="store-locator-result"][value="R480"]
 *     └─ label.form-selector-label
 *          ├─ .form-selector-title（门店名，如 “Apple 解放碑”）
 *          ├─ .rt-storelocator-store-availabilityquote（取货状态，如 “明天 可取货”）
 *          └─ .form-label-small（“店内取货”）
 * 后面几个选择器为旧版布局兜底。
 */
export const APPLE_STORE_CARD_SELECTOR = [
    '.rt-storelocator-store-group .form-selector',
    '.rf-hcard',
    '[class*="hcard"]',
    'li[class*="store"]',
    'div[class*="storecard"]',
    'div[class*="store-card"]',
].join(', ')

/** 获取当前取货门店卡片列表（可见分组在前，收起的“更多取货地点”分组在后） */
export const getStoreCards = (): HTMLElement[] => {
    return Array.from(document.querySelectorAll(APPLE_STORE_CARD_SELECTOR)) as HTMLElement[]
}

/**
 * 判断门店文案是否“可取货”：含肯定词且不含否定词。
 * 注意“不可取货”包含“可取货”子串，必须先排除否定词。
 */
export const isStoreAvailableText = (text: string): boolean => {
    if (!text) return false
    if (/不可取货|无法取货|暂无货|暂无|缺货|无货|不可售|currently unavailable/i.test(text)) return false
    return /可取货|有货|可自提|available/i.test(text)
}

/**
 * 从取货门店列表 UI 中读取当前已被选中的门店
 * 适用场景：页面已经通过用户/页面自身请求选中门店，扩展直接复用该门店号，
 * 避免反复调用搜索接口或循环点击行政区划导致页面抖动。
 */
export const getSelectedStoreInUI = (): { storeNumber: string; storeName: string } | null => {
    try {
        // 1) 优先从带有 selected/active/aria-checked 的门店卡片读取
        const selectedCard = document.querySelector(
            `.rf-hcard.selected, .rf-hcard.active, [class*="store"][aria-checked="true"], [class*="hcard"][aria-checked="true"], [class*="storeselected"], [class*="store-selected"]`
        )
        if (selectedCard) {
            const storeNumber =
                selectedCard.getAttribute('data-store-number') ||
                (
                    selectedCard.querySelector(
                        'input[type="radio"][name*="store"]:checked, input[type="checkbox"][name*="store"]:checked'
                    ) as HTMLInputElement | null
                )?.value ||
                selectedCard.querySelector('[data-store-number]')?.getAttribute('data-store-number')
            const storeName = (
                selectedCard.querySelector('.rf-hcard-store-title')?.textContent ||
                selectedCard.textContent ||
                ''
            ).trim()
            if (storeNumber) return { storeNumber, storeName }
        }

        // 2) 兜底：从门店列表中被选中的 radio/checkbox 读取
        //    新版结账页 radio 为 input[name="store-locator-result"]，其卡片容器为 div.form-selector
        const checkedInput = document.querySelector(
            'input[type="radio"][name*="store"]:checked, input[type="checkbox"][name*="store"]:checked'
        ) as HTMLInputElement | null
        if (checkedInput?.value) {
            const card = checkedInput.closest('.form-selector, [class*="store"], [class*="hcard"]')
            const storeName = (
                card?.querySelector('.form-selector-title, .rf-hcard-store-title')?.textContent ||
                card?.textContent ||
                ''
            ).trim()
            return { storeNumber: checkedInput.value, storeName }
        }
    } catch (e) {
        console.error(`[Adzapple助手] getSelectedStoreInUI error`, e)
    }
    return null
}

type TValue = string | Record<string, any> | Array<any> | null | number | boolean

export const saveToStorage = async <T extends TValue>(tValue: T, storeName: string): Promise<void> => {
    let msg = ''
    // @ts-ignore
    if (typeof chrome === 'undefined' || !chrome.storage) {
        msg = 'Please use as chrome extension'
        return
    }
    console.log(`save to store`, tValue)
    const storedValue = (await restoreFromStorage()) as Record<string, any>
    const storeValue = { ...storedValue, [storeName]: tValue }
    // @ts-ignore
    chrome.storage.sync.set(storeValue)
}

export const restoreFromStorage = async <T extends TValue>(storeName?: string): Promise<T> => {
    let msg = ''
    // @ts-ignore
    if (typeof chrome === 'undefined' || !chrome.storage) {
        msg = 'Please use as chrome extension'
        console.log(`msg`, msg, typeof chrome)
        return null as T
    }

    return new Promise<T>((resolve, reject) => {
        // @ts-ignore
        chrome.storage?.sync.get(null, (items: any) => {
            if (!storeName) {
                resolve({ ...items })
            } else {
                const value = items?.[storeName]
                // incase value is false
                if (value === undefined) {
                    resolve({} as T)
                } else {
                    resolve(value)
                }
            }
        })
    }).catch(e => {
        console.error(e)
        return {} as T
    })
}

/**
 * chrome.storage.local 读写：不随 Google 账号跨设备同步。
 * 激活状态必须用 local 存储，否则同一账号的其他设备会直接继承激活状态，
 * 破坏「一码一机」的绑定（设备码由硬件指纹实时计算，无需存储）。
 */
export const saveToLocalStorage = async <T extends TValue>(tValue: T, storeName: string): Promise<void> => {
    // @ts-ignore
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('Please use as chrome extension')
        return
    }
    const storedValue = (await restoreFromLocalStorage()) as Record<string, any>
    const storeValue = { ...storedValue, [storeName]: tValue }
    // @ts-ignore
    chrome.storage.local.set(storeValue)
}

export const restoreFromLocalStorage = async <T extends TValue>(storeName?: string): Promise<T> => {
    // @ts-ignore
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('Please use as chrome extension')
        return null as T
    }

    return new Promise<T>(resolve => {
        // @ts-ignore
        chrome.storage?.local.get(null, (items: any) => {
            if (!storeName) {
                resolve({ ...items })
            } else {
                const value = items?.[storeName]
                if (value === undefined) {
                    resolve({} as T)
                } else {
                    resolve(value)
                }
            }
        })
    }).catch(e => {
        console.error(e)
        return {} as T
    })
}
