import { beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreSession } from '../src/features/auth/restoreSession'
import { reLogin } from '../src/services/authApi'
import { clearStoredSession, readStoredSession } from '../src/services/sessionStorage'
import { socketClient } from '../src/services/socketClient'
import { store } from '../src/store'
import { sessionCleared, sessionStarted } from '../src/store/slices/authSlice'

vi.mock('../src/services/authApi', () => ({ reLogin: vi.fn() }))
vi.mock('../src/services/sessionStorage', () => ({
    readStoredSession: vi.fn(),
    clearStoredSession: vi.fn(),
}))
vi.mock('../src/services/socketClient', () => ({ socketClient: { disconnect: vi.fn() } }))

const fakeSession = { username: 'demo', reLoginCode: 'old-code' }

beforeEach(() => {
    vi.resetAllMocks()
    store.dispatch(sessionCleared({}))
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
        type Reply = Awaited<ReturnType<typeof reLogin>>
        let resolveReply!: (res: Reply) => void
        const reply = new Promise<Reply>(resolve => { resolveReply = resolve })
        vi.mocked(reLogin).mockReturnValue(reply)

        const restoring = restoreSession()

        expect(store.getState().auth).toMatchObject({ authStatus: 'checking', currentUser: null })
        expect(reLogin).toHaveBeenCalledExactlyOnceWith(fakeSession)

        resolveReply({ status: 'success', data: { ...fakeSession, reLoginCode: 'new-code' } })
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
        expect(store.getState().auth).toMatchObject({
            authStatus: 'unauthenticated',
            currentUser: null,
            restoreError: 'Phiên đã hết hạn, vui lòng đăng nhập lại',
        })
    })

    it('báo lỗi khôi phục nếu RE_LOGIN bị timeout', async () => {
        vi.mocked(reLogin).mockResolvedValue({
            status: 'unknown',
            error: { kind: 'timeout', message: 'Chưa xác định được kết quả khôi phục phiên' },
        })

        await restoreSession()

        expect(clearStoredSession).toHaveBeenCalledOnce()
        expect(store.getState().auth).toMatchObject({
            authStatus: 'unauthenticated',
            restoreError: 'Không thể khôi phục phiên, vui lòng đăng nhập lại',
        })
    })

    it('bỏ thông báo khôi phục lỗi sau khi đăng nhập lại', () => {
        store.dispatch(sessionCleared({ restoreError: 'Phiên đã hết hạn, vui lòng đăng nhập lại' }))

        store.dispatch(sessionStarted('demo'))

        expect(store.getState().auth).toMatchObject({ authStatus: 'authenticated', restoreError: null })
    })

    it('không mở lại phiên nếu kết quả thành công đến sau khi phiên đã đổi', async () => {
        vi.mocked(reLogin).mockImplementation(async () => {
            // Phiên có thể bị xóa trong khi đang chờ server xác nhận
            store.dispatch(sessionCleared({}))
            return { status: 'success', data: { ...fakeSession, reLoginCode: 'new-code' } }
        })

        await restoreSession()

        expect(store.getState().auth).toMatchObject({ authStatus: 'unauthenticated', currentUser: null })
    })
})
