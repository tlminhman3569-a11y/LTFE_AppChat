import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retrySocketConnection, watchSocketConnection } from '../src/features/auth/reconnectSession'
import { reLogin } from '../src/services/authApi'
import { clearStoredSession, readStoredSession } from '../src/services/sessionStorage'
import { socketClient } from '../src/services/socketClient'
import { store } from '../src/store'
import { sessionCleared, sessionStarted } from '../src/store/slices/authSlice'
import type { ConnectionStatus } from '../src/types/api'

vi.mock('../src/services/authApi', () => ({ reLogin: vi.fn() }))
vi.mock('../src/services/sessionStorage', () => ({
    readStoredSession: vi.fn(),
    clearStoredSession: vi.fn(),
}))

const fakeSession = { username: 'demo', reLoginCode: 'old-code' }
type Reply = Awaited<ReturnType<typeof reLogin>>
let onStatus: (status: ConnectionStatus) => void
let stop: () => void

beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    store.dispatch(sessionCleared({}))
    store.dispatch(sessionStarted(fakeSession.username))
    vi.mocked(readStoredSession).mockReturnValue(fakeSession)
    vi.spyOn(socketClient, 'subscribeStatus').mockImplementation(listener => {
        onStatus = listener
        listener('connected')
        return vi.fn()
    })
    vi.spyOn(socketClient, 'getStatus').mockReturnValue('connected')
    vi.spyOn(socketClient, 'disconnect').mockImplementation(() => onStatus('disconnected'))
    stop = watchSocketConnection()
})

afterEach(() => {
    stop()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('Kết nối lại khi đang đăng nhập', () => {
    it('chỉ báo đã kết nối và phát tín hiệu tải lại sau RE_LOGIN', async () => {
        let resolveReply!: (res: Reply) => void
        const reply = new Promise<Reply>(resolve => { resolveReply = resolve })
        vi.mocked(reLogin).mockReturnValue(reply)
        const before = store.getState().auth

        onStatus('disconnected')
        await vi.advanceTimersByTimeAsync(500)
        onStatus('connected')

        expect(reLogin).toHaveBeenCalledExactlyOnceWith(fakeSession, expect.any(Function))
        expect(store.getState().auth).toMatchObject({ connectionStatus: 'reconnecting', reconnectCount: before.reconnectCount })

        resolveReply({ status: 'success', data: { ...fakeSession, reLoginCode: 'new-code' } })
        await vi.advanceTimersByTimeAsync(0)

        expect(store.getState().auth).toMatchObject({
            connectionStatus: 'connected',
            reconnectCount: before.reconnectCount + 1,
            sessionGeneration: before.sessionGeneration,
        })
    })

    it('dừng sau ba lần thử khi mạng vẫn mất', async () => {
        vi.mocked(reLogin).mockResolvedValue({
            status: 'error', error: { kind: 'connection', message: 'Không thể kết nối' },
        })
        const { reconnectCount } = store.getState().auth

        onStatus('disconnected')
        await vi.advanceTimersByTimeAsync(30_000)

        expect(reLogin).toHaveBeenCalledTimes(3)
        expect(store.getState().auth).toMatchObject({ authStatus: 'authenticated', connectionStatus: 'disconnected', reconnectCount })
    })

    it('thử lại sau khi hết lượt và chỉ tải lại sau RE_LOGIN thành công', async () => {
        const login = vi.mocked(reLogin)
        login.mockResolvedValue({
            status: 'error', error: { kind: 'connection', message: 'Không thể kết nối' },
        })
        const { reconnectCount, sessionGeneration } = store.getState().auth

        onStatus('disconnected')
        await vi.advanceTimersByTimeAsync(3500)
        expect(login).toHaveBeenCalledTimes(3)

        let resolveReply!: (res: Reply) => void
        login.mockReturnValueOnce(new Promise<Reply>(resolve => { resolveReply = resolve }))
        retrySocketConnection()
        retrySocketConnection()
        await vi.advanceTimersByTimeAsync(500)
        onStatus('connected')

        expect(login).toHaveBeenCalledTimes(4)
        expect(store.getState().auth).toMatchObject({ connectionStatus: 'reconnecting', reconnectCount })

        resolveReply({ status: 'success', data: { ...fakeSession, reLoginCode: 'new-code' } })
        await vi.advanceTimersByTimeAsync(0)

        expect(store.getState().auth).toMatchObject({
            connectionStatus: 'connected',
            reconnectCount: reconnectCount + 1,
            sessionGeneration,
        })
    })

    it('về đăng nhập nếu server từ chối mã phiên', async () => {
        const message = 'Phiên đã hết hạn, vui lòng đăng nhập lại'
        vi.mocked(reLogin).mockResolvedValue({ status: 'error', error: { kind: 'session', message } })

        onStatus('disconnected')
        await vi.advanceTimersByTimeAsync(500)

        expect(reLogin).toHaveBeenCalledOnce()
        expect(clearStoredSession).toHaveBeenCalledOnce()
        expect(store.getState().auth).toMatchObject({ authStatus: 'unauthenticated', restoreError: message })
    })

    it('bỏ kết quả cũ nếu người dùng đã đổi tài khoản', async () => {
        let resolveReply!: (res: Reply) => void
        const reply = new Promise<Reply>(resolve => { resolveReply = resolve })
        vi.mocked(reLogin).mockReturnValue(reply)
        const { reconnectCount } = store.getState().auth

        onStatus('disconnected')
        await vi.advanceTimersByTimeAsync(500)
        store.dispatch(sessionCleared({}))
        store.dispatch(sessionStarted('other'))
        vi.mocked(readStoredSession).mockReturnValue({ username: 'other', reLoginCode: 'other-code' })
        onStatus('connecting')
        onStatus('connected')
        resolveReply({ status: 'error', error: { kind: 'session', message: 'Phiên đã hết hạn' } })
        await vi.advanceTimersByTimeAsync(0)

        expect(clearStoredSession).not.toHaveBeenCalled()
        expect(store.getState().auth).toMatchObject({ currentUser: 'other', authStatus: 'authenticated', connectionStatus: 'connected', reconnectCount })
    })
})
