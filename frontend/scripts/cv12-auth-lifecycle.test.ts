import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { endSession } from '../src/features/auth/endSession'
import { watchSocketConnection } from '../src/features/auth/reconnectSession'
import { readStoredSession, saveSession } from '../src/services/sessionStorage'
import { socketClient } from '../src/services/socketClient'
import { store } from '../src/store'
import { sessionCleared, sessionStarted } from '../src/store/slices/authSlice'
import type { ConnectionStatus } from '../src/types/api'

const fakeSession = { username: 'demo', reLoginCode: 'old-code' }
const listeners = new Set<(status: ConnectionStatus) => void>()
let stopWatching: (() => void) | undefined

function startWatcher() {
    stopWatching = watchSocketConnection()
}

function stopWatcher() {
    stopWatching?.()
    stopWatching = undefined
}

function loseConnection() {
    listeners.forEach(listener => listener('disconnected'))
}

beforeEach(() => {
    vi.useFakeTimers()
    const storage = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
    })
    store.dispatch(sessionCleared({}))
    store.dispatch(sessionStarted(fakeSession.username))
    saveSession(fakeSession)

    vi.spyOn(socketClient, 'subscribeStatus').mockImplementation(listener => {
        listeners.add(listener)
        listener('connected')
        return () => { listeners.delete(listener) }
    })
    vi.spyOn(socketClient, 'getStatus').mockReturnValue('disconnected')
    vi.spyOn(socketClient, 'connect').mockResolvedValue(undefined)
})

afterEach(() => {
    stopWatcher()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('Vòng đời kết nối của App', () => {
    it('dọn listener và lượt thử cũ khi effect được chạy lại', async () => {
        startWatcher()
        loseConnection()
        expect(vi.getTimerCount()).toBe(1)

        // StrictMode dọn effect trước rồi chạy lại setup
        stopWatcher()
        expect(listeners.size).toBe(0)
        expect(vi.getTimerCount()).toBe(0)

        startWatcher()
        const reqSpy = vi.spyOn(socketClient, 'request').mockResolvedValue({
            event: 'RE_LOGIN', status: 'success', data: { RE_LOGIN_CODE: 'new-code' },
        })
        vi.mocked(socketClient.getStatus).mockReturnValue('connected')

        loseConnection()
        await vi.advanceTimersByTimeAsync(500)

        expect(listeners.size).toBe(1)
        expect(reqSpy).toHaveBeenCalledExactlyOnceWith('RE_LOGIN', { user: 'demo', code: 'old-code' })

        stopWatcher()
        expect(listeners.size).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('bỏ phản hồi RE_LOGIN thành công đến sau khi đăng xuất lúc mất kết nối', async () => {
        type Reply = Awaited<ReturnType<typeof socketClient.request>>
        let sendReply!: (res: Reply) => void
        const reply = new Promise<Reply>(resolve => { sendReply = resolve })
        const reqSpy = vi.spyOn(socketClient, 'request').mockReturnValue(reply)
        const { reconnectCount } = store.getState().auth
        startWatcher()

        loseConnection()
        await vi.advanceTimersByTimeAsync(500)
        expect(reqSpy).toHaveBeenCalledExactlyOnceWith('RE_LOGIN', { user: 'demo', code: 'old-code' })

        await endSession()
        // Phản hồi về sau khi phiên và mã đã bị xóa
        sendReply({ event: 'RE_LOGIN', status: 'success', data: { RE_LOGIN_CODE: 'late-code' } })
        await vi.advanceTimersByTimeAsync(0)

        expect(readStoredSession()).toBeNull()
        expect(store.getState().auth).toMatchObject({
            authStatus: 'unauthenticated', currentUser: null, connectionStatus: 'disconnected', reconnectCount,
        })
        expect(reqSpy).toHaveBeenCalledOnce()
    })
})
