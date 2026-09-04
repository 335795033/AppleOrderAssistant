import { ACTIVATION_SECRET } from './constants'

/**
 * 激活码方案 v2：本地离线生成 + 扩展内校验。
 *
 * 激活码格式：IPO-<YYYYMMDD>-<8位随机盐>-<32位签名>
 *   - 过期日期以 8 位数字表达（如 20261231 = 2026-12-31，当天 23:59:59 前有效）；
 *   - 盐：每次生成时随机取 8 位大写字母/数字，同一到期日可生成无数个不同的码；
 *   - 签名 = SHA-256( SECRET | 到期日期 | 盐 ) 的前 32 位十六进制（大写）。
 *
 * 相比旧版 djb2（32 位空间、可被暴力枚举），SHA-256 + 随机盐：
 *   - 签名空间 2^128，无法穷举；
 *   - 无法通过已有码推导 SECRET，也无法伪造其他日期的码。
 *
 * 生成器见项目根目录 activation-generator.html（离线打开即可生成），
 * 生成逻辑与本文件完全一致，SECRET 必须相同。
 */

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** 纯 JS SHA-256（同步实现，供扩展与离线生成器共用，避免依赖 crypto.subtle 的异步接口） */
export const sha256Hex = (input: string): string => {
    const data = new TextEncoder().encode(input)
    const bitLen = data.length * 8
    const padded: number[] = Array.from(data)
    padded.push(0x80)
    while (padded.length % 64 !== 56) padded.push(0)
    for (let i = 7; i >= 0; i--) padded.push((bitLen / Math.pow(2, i * 8)) & 0xff)

    const H = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ])
    const w = new Uint32Array(64)
    const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0

    for (let off = 0; off < padded.length; off += 64) {
        for (let i = 0; i < 16; i++) {
            const j = off + i * 4
            w[i] = ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
        }
        let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
            const ch = (e & f) ^ (~e & g)
            const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
            const maj = (a & b) ^ (a & c) ^ (b & c)
            const t2 = (S0 + maj) >>> 0
            h = g; g = f; f = e
            e = (d + t1) >>> 0
            d = c; c = b; b = a
            a = (t1 + t2) >>> 0
        }
        H[0] = (H[0] + a) >>> 0
        H[1] = (H[1] + b) >>> 0
        H[2] = (H[2] + c) >>> 0
        H[3] = (H[3] + d) >>> 0
        H[4] = (H[4] + e) >>> 0
        H[5] = (H[5] + f) >>> 0
        H[6] = (H[6] + g) >>> 0
        H[7] = (H[7] + h) >>> 0
    }
    let hex = ''
    for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, '0')
    return hex
}

export const CODE_PREFIX = 'IPO'
const SALT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 由过期日期 + 盐计算签名（取 SHA-256 前 32 位十六进制，大写） */
export const makeActivationSignature = (expiry: string, salt: string): string =>
    sha256Hex(`${ACTIVATION_SECRET}|${expiry}|${salt}`).slice(0, 32).toUpperCase()

/** 生成随机盐（8 位，去除易混淆字符） */
export const makeSalt = (): string => {
    let salt = ''
    for (let i = 0; i < 8; i++) salt += SALT_CHARS[Math.floor(Math.random() * SALT_CHARS.length)]
    return salt
}

/** 生成激活码（供本地生成器/调试使用；正常分发走根目录 HTML） */
export const generateActivationCode = (expiry: string /* YYYYMMDD */, salt?: string): string => {
    const s = salt || makeSalt()
    return `${CODE_PREFIX}-${expiry}-${s}-${makeActivationSignature(expiry, s)}`
}

export interface IActivationResult {
    valid: boolean
    /** 验证通过时的到期时间戳(ms)，当天 23:59:59 */
    validUntil?: number
    reason?: string
}

/** 校验激活码：格式 → 签名 → 过期时间 */
export const verifyActivationCode = (code?: string | null): IActivationResult => {
    const parts = (code || '').trim().toUpperCase().split('-')
    if (parts.length !== 4 || parts[0] !== CODE_PREFIX) {
        return { valid: false, reason: '激活码格式不正确' }
    }
    const [, expiry, salt, sig] = parts
    if (!/^\d{8}$/.test(expiry)) {
        return { valid: false, reason: '激活码格式不正确' }
    }
    if (!/^[A-Z0-9]{8}$/.test(salt)) {
        return { valid: false, reason: '激活码格式不正确' }
    }
    if (makeActivationSignature(expiry, salt) !== sig) {
        return { valid: false, reason: '激活码无效' }
    }
    const y = Number(expiry.slice(0, 4))
    const m = Number(expiry.slice(4, 6))
    const d = Number(expiry.slice(6, 8))
    if (m < 1 || m > 12 || d < 1 || d > 31) {
        return { valid: false, reason: '激活码日期不合法' }
    }
    const validUntil = new Date(y, m - 1, d, 23, 59, 59).getTime()
    if (Date.now() > validUntil) {
        return { valid: false, reason: '激活码已过期' }
    }
    return { valid: true, validUntil }
}
