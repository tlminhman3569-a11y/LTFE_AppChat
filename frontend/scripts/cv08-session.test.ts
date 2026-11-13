import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logout, reLogin } from '../src/services/authApi'
import { clearStoredSession, readStoredSession, saveSession } from '../src/services/sessionStorage'
import { socketClient, SocketRequestError } from '../src/services/socketClient'

const fakeSession = { username: 'demo', reLoginCode: 'old-code' }
const STORAGE_KEY = 'appchat.session'

function mockSessionStorage() {
    const store = new Map<string, string>()
    return {
        getItem: vi.fn((k: string) => store.get(k) ?? null),
        setItem: vi.fn((k: string, v: string) => store.set(k, v)),
        removeItem: vi.fn((k: string) => store.delete(k)),
    }
}

let storage: ReturnType<typeof mockSessionStorage>

beforeEach(() => {
    storage = mockSessionStorage()
    vi.stubGlobal('sessionStorage', storage)

    vi.spyOn(socketClient, 'connect').mockResolvedValue(undefined)
    vi.spyOn(socketClient, 'disconnect').mockImplementation(() => {})
    vi.spyOn(socketClient, 'clearSessionListeners').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('sessionStorage', () => {
    it('chỉ lưu username và code, bỏ qua password', () => {
        const input = { ...fakeSession, password: 'sample-password' }

        saveSession(input)

        expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(fakeSession))
        expect(readStoredSession()).toEqual(fakeSession)
    })

    it('xóa dữ liệu nếu JSON trong storage bị lỗi', () => {
        storage.setItem(STORAGE_KEY, '{broken')

        const stored = readStoredSession()

        expect(stored).toBeNull()
        expect(storage.getItem(STORAGE_KEY)).toBeNull()
    })
})

describe('reLogin', () => {
    beforeEach(() => saveSession(fakeSession))

    it('gửi code cũ lên server rồi lưu code mới', async () => {
        const reqSpy = vi.spyOn(socketClient, 'request').mockResolvedValue({
            event: 'RE_LOGIN',
            status: 'success',
            data: { RE_LOGIN_CODE: 'new-code' },
        })
        const newSession = { username: 'demo', reLoginCode: 'new-code' }

        const res = await reLogin(fakeSession)

        expect(res).toEqual({ status: 'success', data: newSession })
        expect(socketClient.connect).toHaveBeenCalledWith('wss://chat.longapp.io.vn/chat/chat')
        expect(reqSpy).toHaveBeenCalledWith('RE_LOGIN', { user: 'demo', code: 'old-code' })
        expect(readStoredSession()).toEqual(newSession)
    })

    it('trả lỗi hết phiên và ngắt socket khi code bị từ chối', async () => {
        vi.spyOn(socketClient, 'request').mockResolvedValue({ event: 'RE_LOGIN', status: 'error' })

        const res = await reLogin(fakeSession)

        expect(res).toEqual({
            status: 'error',
            error: { kind: 'session', message: 'Phiên đã hết hạn, vui lòng đăng nhập lại' },
        })
        expect(socketClient.disconnect).toHaveBeenCalledOnce()
    })

    it('báo lỗi parse nếu server trả success mà thiếu RE_LOGIN_CODE', async () => {
        vi.spyOn(socketClient, 'request').mockResolvedValue({ event: 'RE_LOGIN', status: 'success', data: {} })

        const res = await reLogin(fakeSession)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'parse' } })
        expect(socketClient.disconnect).toHaveBeenCalledOnce()
        expect(readStoredSession()).toEqual(fakeSession)
    })

    it('trả unknown khi RE_LOGIN bị timeout', async () => {
        const err = new SocketRequestError('Hết thời gian chờ phản hồi', 'timeout', true)
        vi.spyOn(socketClient, 'request').mockRejectedValue(err)

        const res = await reLogin(fakeSession)

        expect(res).toMatchObject({ status: 'unknown', error: { kind: 'timeout' } })
    })

    it('bỏ qua code mới nếu phiên đã bị xóa trong lúc reLogin', async () => {
        vi.spyOn(socketClient, 'request').mockImplementation(async () => {
            // Người dùng đã xóa phiên khi server còn đang xử lý RE_LOGIN
            clearStoredSession()
            return { event: 'RE_LOGIN', status: 'success', data: { RE_LOGIN_CODE: 'new-code' } }
        })

        await reLogin(fakeSession)

        expect(readStoredSession()).toBeNull()
    })
})

describe('logout', () => {
    it('xóa session trong storage trước khi gửi LOGOUT', async () => {
        saveSession(fakeSession)
        vi.spyOn(socketClient, 'getStatus').mockReturnValue('connected')

        vi.spyOn(socketClient, 'request').mockImplementation(async () => {
            // Nếu xóa sau phản hồi, refresh lúc chờ LOGOUT có thể khôi phục phiên cũ
            expect(readStoredSession()).toBeNull()
            return { event: 'LOGOUT', status: 'error' }
        })

        const res = await logout()

        expect(res).toMatchObject({ status: 'error', error: { kind: 'business' } })
        expect(readStoredSession()).toBeNull()
    })
})
