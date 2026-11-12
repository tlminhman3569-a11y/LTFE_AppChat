import { beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreSession } from '../src/features/auth/restoreSession'
import { reLogin } from '../src/services/authApi'
import { clearStoredSession, readStoredSession } from '../src/services/sessionStorage'
import { socketClient } from '../src/services/socketClient'
import { store } from '../src/store'
import { sessionCleared } from '../src/store/slices/authSlice'

vi.mock('../src/services/authApi', () => ({ reLogin: vi.fn() }))
vi.mock('../src/services/sessionStorage', () => ({
    readStoredSession: vi.fn(),
    clearStoredSession: vi.fn(),
}))
vi.mock('../src/services/socketClient', () => ({ socketClient: { disconnect: vi.fn() } }))

const fakeSession = { username: 'demo', reLoginCode: 'old-code' }

beforeEach(() => {
    vi.resetAllMocks()
    store.dispatch(sessionCleared())
    vi.mocked(readStoredSession).mockReturnValue(fakeSession)
})

describe('Khôi phục phiên khi mở trang', () => {
    it('bỏ qua RE_LOGIN nếu storage chưa có phiên', async () => {
        vi.mocked(readStoredSession).mockReturnValue(null)

        await restoreSession()

        expect(reLogin).not.toHaveBeenCalled()
        expect(store.getState().auth.authStatus).toBe('unauthenticated')
    })

    it('giữ trạng thái kiểm tra cho tới khi RE_LOGIN thành công', async () => {
        const reply = Promise.withResolvers<Awaited<ReturnType<typeof reLogin>>>()
        vi.mocked(reLogin).mockReturnValue(reply.promise)

        const restoring = restoreSession()

        expect(store.getState().auth).toMatchObject({ authStatus: 'checking', currentUser: null })
        expect(reLogin).toHaveBeenCalledExactlyOnceWith(fakeSession)

        reply.resolve({ status: 'success', data: { ...fakeSession, reLoginCode: 'new-code' } })
        await restoring

        expect(store.getState().auth).toMatchObject({ authStatus: 'authenticated', currentUser: 'demo' })
        expect(clearStoredSession).not.toHaveBeenCalled()
    })

    it('xóa phiên đã lưu khi server từ chối mã', async () => {
        vi.mocked(reLogin).mockResolvedValue({
            status: 'error', error: { kind: 'session', message: 'Phiên đã hết hạn, vui lòng đăng nhập lại' },
        })

        await restoreSession()

        expect(clearStoredSession).toHaveBeenCalledOnce()
        expect(socketClient.disconnect).toHaveBeenCalledOnce()
        expect(store.getState().auth).toMatchObject({ authStatus: 'unauthenticated', currentUser: null })
    })

    it('không mở lại phiên nếu kết quả thành công đến sau khi phiên đã đổi', async () => {
        vi.mocked(reLogin).mockImplementation(async () => {
            // Phiên có thể bị xóa trong khi đang chờ server xác nhận
            store.dispatch(sessionCleared())
            return { status: 'success', data: { ...fakeSession, reLoginCode: 'new-code' } }
        })

        await restoreSession()

        expect(store.getState().auth).toMatchObject({ authStatus: 'unauthenticated', currentUser: null })
    })
})
