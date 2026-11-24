import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'node:process'
import { login, logout, reLogin } from '../src/services/authApi'
import { readStoredSession, saveSession } from '../src/services/sessionStorage'
import { socketClient } from '../src/services/socketClient'

const username = env.APPCHAT_PROBE_USER
const password = env.APPCHAT_PROBE_PASS
const runLive = Boolean(username && password)

afterEach(() => {
    socketClient.disconnect()
    vi.unstubAllGlobals()
})

describe('Khôi phục phiên với API thật', () => {
    it.skipIf(!runLive)('đăng nhập rồi mở socket mới bằng mã phiên vừa nhận', async () => {
        const storage = new Map<string, string>()
        vi.stubGlobal('sessionStorage', {
            getItem: (k: string) => storage.get(k) ?? null,
            setItem: (k: string, v: string) => storage.set(k, v),
            removeItem: (k: string) => storage.delete(k),
        })

        const res = await login(username!, password!)

        expect(res.status).toBe('success')
        if (res.status !== 'success') return

        saveSession(res.data)
        socketClient.disconnect()

        try {
            const restored = await reLogin(res.data)
            const saved = readStoredSession()

            // Chỉ kiểm tra trạng thái, không để mã phiên lọt vào output khi test lỗi
            expect(restored.status).toBe('success')
            expect(socketClient.getStatus()).toBe('connected')
            if (restored.status !== 'success') return

            const sessionMatches = saved?.username === restored.data.username
                && saved?.reLoginCode === restored.data.reLoginCode

            expect(sessionMatches).toBe(true)

            const reply = await socketClient.request('GET_USER_LIST', {})

            expect(reply.status).toBe('success')
            expect(Array.isArray(reply.data)).toBe(true)
        } finally {
            await logout()
        }
    }, 35000)
})
