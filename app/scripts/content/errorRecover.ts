/*
 * 错误页(404/风控)自动识别 + 会话自愈
 *
 * 背景：长时间高频调用 /shop/checkoutx 刷库存接口时，苹果(及其风控)会把当前
 *       浏览器会话标记为机器人流量。被标记后，该会话后续访问 apple.com.cn 的
 *       任意页面都会返回 404("未找到页面")—— 表现为：刷着刷着整个页面跳成 404，
 *       手动清缓存/开无痕窗口(相当于换新会话)能恢复一会儿，之后再次被标记又 404。
 *
 * 本模块做的事情与"清缓存 + 无痕窗口"等价，只是自动完成：
 *   1. 识别当前页面是不是苹果的错误页(标题/正文特征，而不是请求状态码)；
 *   2. 清除当前 apple.com.cn 会话里可被脚本删除的 cookie
 *      (风控指纹类 cookie 通常非 HttpOnly，可删；登录态 HttpOnly cookie 不受影响)；
 *   3. 跳回购物车页重新建立会话、继续捡漏。
 *
 * 不依赖任何业务模块，可被多个调用方复用。
 */

import { saveToStorage, restoreFromStorage } from '../../shared/util'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ********** 404 自愈刹车 **********
// 场景：会话被风控/商品不可购时，页面反复被苹果踢到 /shop/404，而每次自愈(清 cookie→回购物车)
// 又会触发插件自动再结账→再 404，形成死循环，且反复清 cookie 还会连带掉登录态。
// 方案：统计一段时间内的自愈次数，超过阈值就暂停“自动下单”一段时间，让用户人工确认。
const RECOVER_LOG_KEY = `orderRecoverLog` // { count, firstTs }
const PAUSE_KEY = `orderAutoPauseUntil` // 暂停到的时间戳(ms)
const RECOVER_WINDOW_MS = 10 * 60 * 1000 // 统计窗口 10 分钟
const RECOVER_MAX_IN_WINDOW = 3 // 窗口内自愈 3 次即刹车
const PAUSE_MS = 10 * 60 * 1000 // 刹车 10 分钟

/** 每次执行 404 自愈后调用：累计次数，超过阈值则暂停自动下单 */
const maybePauseAfterRecover = async (): Promise<void> => {
    try {
        const now = Date.now()
        const log = (await restoreFromStorage(RECOVER_LOG_KEY)) as Record<string, any> | undefined
        const inWindow = log?.firstTs && now - Number(log.firstTs) < RECOVER_WINDOW_MS
        const count = (inWindow ? Number(log?.count || 0) : 0) + 1
        const firstTs = inWindow ? Number(log.firstTs) : now
        await saveToStorage({ count, firstTs }, RECOVER_LOG_KEY)
        if (count >= RECOVER_MAX_IN_WINDOW) {
            await saveToStorage(now + PAUSE_MS, PAUSE_KEY)
            console.warn(
                `[Adzapple助手] ${
                    RECOVER_WINDOW_MS / 60000
                }分钟内已连续自愈${count}次，疑似当前会话被风控或商品/门店不可购买。自动下单已暂停 ${
                    PAUSE_MS / 60000
                } 分钟，请人工确认(到配置页重新保存可立即解除暂停)。`
            )
        }
    } catch (e) {
        console.error(`[Adzapple助手] maybePauseAfterRecover error`, e)
    }
}

/** 距自动下单暂停结束还剩多少 ms(0 表示未暂停) */
export const getAutoPauseRemainMs = async (): Promise<number> => {
    try {
        const until = (await restoreFromStorage(PAUSE_KEY)) as number | undefined
        if (!until) return 0
        const remain = Number(until) - Date.now()
        return remain > 0 ? remain : 0
    } catch (e) {
        return 0
    }
}

/** 判断当前页面是否为苹果的 "未找到页面/404" 错误页 */
export const isAppleErrorPage = (): boolean => {
    try {
        const title = (document.title || '').toLowerCase()
        // 苹果官方错误页：中国站 <title>未找到页面 - Apple (中国大陆)</title>
        if (title.includes('未找到页面') || title.includes('404') || /page\s+not\s+found/.test(title)) {
            return true
        }
        // 兜底：正文特征（只取前 3000 字符，避免长页面开销）
        const bodyText = (document.body?.innerText || '').slice(0, 3000).replace(/\s+/g, ' ')
        if (bodyText.includes('你要查找的网页找不到') || bodyText.includes('抱歉，你要查找的网页不存在')) {
            return true
        }
        if (/the\s+page\s+you.{0,60}(not\s+be\s+found|does\s+not\s+exist)/i.test(bodyText)) {
            return true
        }
        return false
    } catch (e) {
        console.error(`[Adzapple助手] isAppleErrorPage error`, e)
        return false
    }
}

/** 清除当前 apple.com.cn 会话中可由脚本删除的 cookie，返回尝试清理的数量 */
export const clearAppleCookies = (): number => {
    let removed = 0
    try {
        const names = (document.cookie || '')
            .split(';')
            .map(c => c.split('=')[0].trim())
            .filter(Boolean)
        if (!names.length) return 0

        // domain 候选：www.apple.com.cn / .apple.com.cn / apple.com.cn
        const hostParts = location.hostname.split('.')
        const rootDomain = hostParts.slice(-2).join('.')
        const domainCandidates = [location.hostname, `.${location.hostname}`, rootDomain, `.${rootDomain}`]
        // 大多数 apple cookie 的 path 都是 /，这里统一按 / 过期
        const expired = `expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=-1; path=/`

        names.forEach(name => {
            try {
                document.cookie = `${name}=; ${expired}`
                removed++
            } catch (e) {
                /* ignore */
            }
            domainCandidates.forEach(domain => {
                try {
                    document.cookie = `${name}=; ${expired}; domain=${domain}`
                } catch (e) {
                    /* ignore */
                }
            })
        })
        console.log(`[Adzapple助手] cleared cookies: ${names.join(', ')}`)
    } catch (e) {
        console.error(`[Adzapple助手] clearAppleCookies error`, e)
    }
    return removed
}

/**
 * 自愈入口：若当前页面是苹果错误页(404/风控标记)，
 * 则清理被标记的 cookie 并跳回购物车重建会话。
 * @returns 是否执行了恢复动作
 */
export const autoRecoverIfErrorPage = async (): Promise<boolean> => {
    if (!isAppleErrorPage()) return false
    console.warn(`[Adzapple助手] 检测到苹果错误页，疑似被风控标记，自动清理会话 cookie 并回到购物车重建会话...`)
    clearAppleCookies()
    // 统计自愈次数，过于频繁则暂停自动下单，避免“404→清cookie→自动再结账→404”死循环
    await maybePauseAfterRecover()
    await sleep(800)
    try {
        location.replace('https://www.apple.com.cn/shop/bag')
    } catch (e) {
        console.error(`[Adzapple助手] recover redirect error`, e)
        location.href = 'https://www.apple.com.cn/shop/bag'
    }
    return true
}

/** 主动轮换会话：清 cookie 后整页刷新（用于轮询达到阈值/连续失败时的自愈） */
export const rotateSessionAndReload = async (markText?: string): Promise<void> => {
    console.warn(`[Adzapple助手] rotate session, ${markText || ''}`)
    clearAppleCookies()
    await sleep(600 + Math.random() * 1000)
    location.reload()
}
