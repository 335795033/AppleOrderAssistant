import { sleep, getElemByID, getElemBySelectorAndText } from '../../shared/util'
import { pageElementsId } from '../../shared/constants'
import type { IPHONEORDER_CONFIG } from '../../shared/interface'

/*
 * 苹果安全结账登录页自动化（2026 适配版）
 *
 * 背景：/shop/signIn(secure.www.apple.com.cn) 的登录表单由 idmsa appleauth JS
 * 以 embed 模式【动态渲染】，与 2023 年的差异：
 *   1. 旧版写死的元素 ID(signIn.customerLogin.appleId 等)已不存在；
 *   2. 表单渲染晚于页面加载，旧逻辑"执行一次找不到就 return"必然卡死；
 *   3. 表单是"先输账号 → 继续(→箭头) → 再输密码"的两步式。
 *
 * 策略：轮询等待动态表单出现 + 基于可见输入框的智能选择 + 两步式适配
 *       + 同意弹窗处理 + 未配置账号时游客结账兜底。
 */

const { signIn: signInElems } = pageElementsId

// 账号输入框候选：新页面动态表单优先，旧版 ID 兜底(CSS 转义)
const ACCOUNT_INPUT_CANDIDATES = [
    '#signin-container input[type="email"]',
    '#signin-container input[type="text"]',
    '#signin-container input[name="loginId"]',
    '#signin-container input[name="email"]',
    '#signin-container input[autocomplete*="email"]',
    '#signin-container input[autocomplete*="username"]',
    '#signin-container input[autocomplete*="account-name"]',
    '#signin-container input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"])',
    'input#email',
    'input#account_name_text_field',
    'input#signIn\.customerLogin\.appleId',
    '#signIn\.customerLogin\.appleId',
]

// 密码输入框候选
const PASSWORD_INPUT_CANDIDATES = [
    '#signin-container input[type="password"]',
    '#signin-container input[name="password"]',
    'input#password',
    'input[type="password"]',
    '#signIn\.customerLogin\.password',
]

// 提交/继续按钮候选（新版 Apple ID 登录常见结构）
const SUBMIT_BTN_CANDIDATES = [
    '#sign-in',
    'button#sign-in',
    'button.si-button',
    'button[aria-label="继续"]',
    'button[aria-label="下一步"]',
    'button[aria-label="Sign in"]',
    'button[aria-label="Continue"]',
    '#signin-submit-button',
    '#signin-container button[type="submit"]',
    '#signin-container button[id*="sign-in" i]',
    '#signin-container button[id*="continue" i]',
    'button[id*="signin" i][type="submit"]',
    'button[id*="continue" i]',
    'button[type="submit"]',
]

// 游客结账按钮文案候选
const GUEST_BTN_TEXTS = ['访客', '以访客身份', 'Guest', 'guest']

const isVisible = (el: HTMLElement) => {
    if (!el) return false
    const rect = el.getBoundingClientRect?.() as DOMRect
    return !!rect && rect.width > 0 && rect.height > 0
}

// 按钮是否可交互（不禁用）
const isClickable = (el: HTMLElement) => {
    if (!el) return false
    if ((el as HTMLButtonElement).disabled) return false
    const ariaDisabled = el.getAttribute('aria-disabled')
    if (ariaDisabled === 'true') return false
    return isVisible(el)
}

/**
 * 尽可能真实地填充输入框：
 * 新版 Apple ID 登录表单基于 JS 框架监听 input / change / blur，
 * 只改 value 不触发事件会导致框架内部状态为空，按钮点了也提交不了。
 */
const safeSetInputValue = (inputEl: HTMLInputElement, value?: string) => {
    if (!inputEl || value === undefined) return
    inputEl.focus()
    const lastValue = inputEl.value
    inputEl.value = value

    // 兼容 React / Vue 等受控组件的 value tracker
    const tracker = (inputEl as any)._valueTracker
    if (tracker && typeof tracker.setValue === 'function') {
        tracker.setValue(lastValue)
    }

    const events = ['input', 'change', 'keyup']
    events.forEach(eventName => {
        if (eventName === 'keyup') {
            inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', code: 'End', bubbles: true }))
        } else {
            inputEl.dispatchEvent(new Event(eventName, { bubbles: true }))
        }
    })

    inputEl.blur()
}

// 勾选“记住我的账户”
const checkRememberMe = async () => {
    const candidates = [
        'input#remember-me',
        'input[type="checkbox"][id*="remember" i]',
        'input[type="checkbox"][name*="remember" i]',
    ]
    let checkbox: HTMLInputElement | null = null
    for (const selector of candidates) {
        const found = document.querySelector(selector) as HTMLInputElement
        if (found) {
            checkbox = found
            break
        }
    }
    if (!checkbox) return

    if (!checkbox.checked) {
        checkbox.checked = true
        checkbox.dispatchEvent(new Event('change', { bubbles: true }))
        checkbox.dispatchEvent(new Event('input', { bubbles: true }))
        checkbox.click()
        console.log(`doSignIn: checked remember-me`)
    }
    await sleep(0.3)
}

/**
 * 模拟完整鼠标/指针事件链点击，提高在 Apple ID 登录 iframe 中的成功率。
 * 普通 element.click() 有时不会触发框架绑定的 ($click) 处理函数。
 */
const fireClick = (el: HTMLElement) => {
    if (!el) return
    try {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as any })
    } catch (e) {}
    el.focus()

    const rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const pointerInit: PointerEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        clientX: x,
        clientY: y,
    }
    const mouseInit: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        clientX: x,
        clientY: y,
    }

    el.dispatchEvent(new PointerEvent('pointerdown', pointerInit))
    el.dispatchEvent(new MouseEvent('mousedown', mouseInit))
    el.dispatchEvent(new PointerEvent('pointerup', pointerInit))
    el.dispatchEvent(new MouseEvent('mouseup', mouseInit))
    el.dispatchEvent(new MouseEvent('click', mouseInit))
    el.click()
}

// 依次尝试候选选择器，返回第一个"可见"的命中元素(无可见则返回第一个命中)
const findVisible = (candidates: string[]): HTMLElement | null => {
    let fallback: HTMLElement | null = null
    for (const selector of candidates) {
        try {
            const els = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
            const visible = els.find(isVisible)
            if (visible) return visible
            if (els.length && !fallback) fallback = els[0]
        } catch (e) {
            // 无效选择器，跳过
        }
    }
    return fallback
}

// 轮询等待任一候选元素出现
const waitForElem = async (candidates: string[], timeoutSec = 30): Promise<HTMLElement | null> => {
    const start = Date.now()
    while (Date.now() - start < timeoutSec * 1000) {
        const found = findVisible(candidates)
        if (found) return found
        await sleep(0.8)
    }
    return findVisible(candidates)
}

// 智能查找账号输入框：先精确候选，再回退到"登录容器内第一个可见的非密码输入框"
const findAccountInput = (): HTMLElement | null => {
    const precise = findVisible(ACCOUNT_INPUT_CANDIDATES)
    if (precise) return precise

    // 兜底：在 signin-container / signin 区域内找第一个可见的、可输入的非密码元素
    const containers = Array.from(
        document.querySelectorAll('#signin-container, #signin, [id*="signin" i], [class*="signin" i]')
    ) as HTMLElement[]
    for (const container of containers) {
        if (!isVisible(container)) continue
        const inputs = Array.from(
            container.querySelectorAll('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"])')
        ) as HTMLInputElement[]
        const visible = inputs.find(isVisible)
        if (visible) return visible
    }

    // 终极兜底：整个文档里找 placeholder/aria-label 含邮箱/账户/电话的可见输入框
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
    return (
        inputs.find(el => {
            if (!isVisible(el)) return false
            const ph = (el.placeholder || '').toLowerCase()
            const label = (el.getAttribute('aria-label') || '').toLowerCase()
            const auto = (el.getAttribute('autocomplete') || '').toLowerCase()
            return (
                ph.includes('电子邮件') ||
                ph.includes('电话号码') ||
                ph.includes('apple') ||
                label.includes('apple') ||
                label.includes('账户') ||
                label.includes('账号') ||
                auto.includes('email') ||
                auto.includes('username')
            )
        }) || null
    )
}

// 找"继续"按钮：优先在账号输入框所在 form / 父容器内查找，其次全局候选
const findContinueBtn = (inputEl: HTMLElement | null): HTMLElement | null => {
    // 1. 新版 Apple ID 登录箭头按钮：按钮内含 icon_sign_in 子元素
    const iconEl = document.querySelector('.icon_sign_in') as HTMLElement
    if (iconEl) {
        let p: HTMLElement | null = iconEl
        while (p && p.tagName !== 'BUTTON') {
            p = p.parentElement
        }
        if (p && isVisible(p)) return p
    }

    // 2. 旧版 ID
    const oldBtn = getElemByID(signInElems.loginSubmitButton)
    if (oldBtn && isVisible(oldBtn)) return oldBtn

    if (inputEl) {
        // 3. 输入框所在 form 的提交按钮
        const form = inputEl.closest?.('form')
        if (form) {
            const formBtn = form.querySelector(
                'button[type="submit"], input[type="submit"], button:not([type])'
            ) as HTMLElement
            if (formBtn && isVisible(formBtn)) return formBtn
        }

        // 4. 输入框父容器内所有可见按钮（新版箭头按钮通常和输入框在同一容器）
        let parent: HTMLElement | null = inputEl
        for (let i = 0; i < 6 && parent; i++) {
            const btns = Array.from(parent.querySelectorAll('button, a, [role="button"]')) as HTMLElement[]
            const visibleBtn = btns.find(b => isVisible(b) && b !== inputEl)
            if (visibleBtn) return visibleBtn
            parent = parent.parentElement
        }
    }

    // 5. 在 signin 容器里查找
    const containers = Array.from(
        document.querySelectorAll('#signin-container, #signin, [id*="signin" i], [class*="signin" i]')
    ) as HTMLElement[]
    for (const container of containers) {
        const btns = Array.from(container.querySelectorAll('button')) as HTMLElement[]
        const visibleBtn = btns.find(isVisible)
        if (visibleBtn) return visibleBtn
    }

    // 6. 全局候选
    return findVisible(SUBMIT_BTN_CANDIDATES)
}

// 找最终登录/提交按钮（密码框阶段）
const findSubmitBtn = (inputEl: HTMLElement | null): HTMLElement | null => {
    return findContinueBtn(inputEl)
}

/*
 * 处理"数据同意"弹窗：
 * 旧版：两个指定 checkbox + 接受按钮；
 * 新版：容器 id 含 consent 的浮层里勾选未勾选的 checkbox，再点提交按钮。
 */
const handleConsent = async () => {
    const dataHandleByAppleCheckbox = getElemByID(signInElems.dataHandleByAppleCheckbox) as HTMLInputElement
    if (dataHandleByAppleCheckbox) {
        const dataOutSideMyCountryCheckbox = getElemByID(
            signInElems.dataOutSideMyCountryCheckbox
        ) as HTMLInputElement
        dataHandleByAppleCheckbox.click()
        dataHandleByAppleCheckbox.checked = true
        dataOutSideMyCountryCheckbox?.click()
        if (dataOutSideMyCountryCheckbox) dataOutSideMyCountryCheckbox.checked = true
        getElemByID(signInElems.acceptButton)?.click()
        await sleep(0.5)
        return
    }

    try {
        const overlays = Array.from(
            document.querySelectorAll('[id*="consent" i], [class*="consent" i]')
        ) as HTMLElement[]
        for (const overlay of overlays) {
            const unchecked = Array.from(
                overlay.querySelectorAll('input[type="checkbox"]:not(:checked)')
            ) as HTMLInputElement[]
            if (!unchecked.length) continue
            unchecked.forEach(cb => cb.click())
            const acceptBtn =
                (overlay.querySelector('button[type="submit"], button') as HTMLElement) || null
            acceptBtn?.click()
            await sleep(0.5)
            return
        }
    } catch (e) {
        console.log(`handleConsent error`, e)
    }
}

// 游客身份结账
const doGuestCheckout = async (): Promise<boolean> => {
    const oldBtn = getElemByID(signInElems.guestLoginButon)
    if (oldBtn) {
        console.log(`click guestLoginBtn(old)`, oldBtn)
        oldBtn.click()
        return true
    }
    for (const text of GUEST_BTN_TEXTS) {
        const btn = getElemBySelectorAndText(
            '#signin-container button, #signin-container a, button, a',
            text
        )
        if (btn && isVisible(btn)) {
            console.log(`click guestLoginBtn(text:${text})`, btn)
            btn.click()
            return true
        }
    }
    return false
}

// 等待某个查找函数返回可点击元素
const waitForClickable = async (
    findFn: () => HTMLElement | null,
    timeoutSec = 10
): Promise<HTMLElement | null> => {
    const start = Date.now()
    while (Date.now() - start < timeoutSec * 1000) {
        const el = findFn()
        if (el && isClickable(el)) return el
        await sleep(0.5)
    }
    return findFn()
}

// 账号 + 密码登录(兼容两步式)
const doLogin = async (appleId?: string, password?: string): Promise<boolean> => {
    const accountInput = await waitForElem(ACCOUNT_INPUT_CANDIDATES, 40)
    if (!accountInput) {
        // 再尝试一次智能查找
        const smartAccount = findAccountInput()
        if (!smartAccount) {
            console.warn(`doSignIn: account input not found after waiting`)
            return false
        }
        console.log(`doSignIn: found account input by smart fallback`, smartAccount)
    }

    const input = (accountInput || findAccountInput()) as HTMLInputElement
    safeSetInputValue(input, appleId)
    await sleep(0.5)

    // 密码框是否与账号框同屏(旧版一步式表单)
    let passwordInput = findVisible(PASSWORD_INPUT_CANDIDATES)
    if (!passwordInput) {
        // 两步式：点"继续"按钮，等待密码框出现
        const continueBtn = await waitForClickable(() => findContinueBtn(input), 10)
        if (continueBtn && isClickable(continueBtn)) {
            console.log(`doSignIn: click continue`, continueBtn)
            fireClick(continueBtn)
        } else {
            console.warn(`doSignIn: continue button not found, try Enter`)
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
            input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }))
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
        }
        await sleep(1.2)
        passwordInput = await waitForElem(PASSWORD_INPUT_CANDIDATES, 15)
    }
    if (!passwordInput) {
        console.warn(`doSignIn: password input not found`)
        return false
    }

    safeSetInputValue(passwordInput as HTMLInputElement, password)
    await sleep(0.5)

    // 勾选“记住我的账户”（用户要求）
    await checkRememberMe()

    const submitBtn = await waitForClickable(() => findSubmitBtn(passwordInput), 10)
    if (!submitBtn) {
        console.warn(`doSignIn: submit button not found`)
        return false
    }

    console.log(`doSignIn: submit login`, submitBtn)
    fireClick(submitBtn)

    // 等待提交生效：如果 2.5s 后还停留在登录页且密码框仍在，可能是 click 没触发，重试一次
    await sleep(2.5)
    if (/\/signin/i.test(location.pathname) && findVisible(PASSWORD_INPUT_CANDIDATES)) {
        console.warn(`doSignIn: submit did not navigate, retry fill & click`)
        safeSetInputValue(passwordInput as HTMLInputElement, password)
        await checkRememberMe()
        fireClick(submitBtn)
        await sleep(2.5)
    }

    const stillOnSignIn = /\/signin/i.test(location.pathname) && findVisible(PASSWORD_INPUT_CANDIDATES)
    if (stillOnSignIn) {
        console.warn(`doSignIn: still on signin page after submit`)
        return false
    }
    return true
}

const doSignIn = async (iPhoneOrderConfig: IPHONEORDER_CONFIG) => {
    const { appleId, password } = iPhoneOrderConfig || {}

    // 表单是动态渲染的：等待期间循环处理可能弹出的数据同意弹窗
    const start = Date.now()
    while (Date.now() - start < 40 * 1000) {
        await handleConsent()
        if (findVisible(ACCOUNT_INPUT_CANDIDATES) || findAccountInput()) break
        if (appleId && password && getElemByID(signInElems.appleIdInput)) break
        await sleep(1)
    }

    if (appleId && password) {
        let ok = await doLogin(appleId, password)
        if (!ok) {
            // 渲染慢导致的失败：稍等后重试一轮
            await sleep(2)
            ok = await doLogin(appleId, password)
        }
        if (!ok) {
            console.warn(
                `doSignIn: login failed, please check appleId/password config or login manually`
            )
        }
        return
    }

    // 没有配置账号密码：以游客身份结账
    console.log(`doSignIn: no appleId config, try guest checkout`)
    const guestOk = await doGuestCheckout()
    if (!guestOk) {
        console.warn(`doSignIn: guest checkout button not found, please login manually`)
    }
}

export default doSignIn
