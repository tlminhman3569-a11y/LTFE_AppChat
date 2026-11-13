import { reLogin } from '../../services/authApi'
import { clearStoredSession, readStoredSession } from '../../services/sessionStorage'
import { socketClient } from '../../services/socketClient'
import { store } from '../../store'
import { sessionChecking, sessionCleared, sessionStarted } from '../../store/slices/authSlice'

export async function restoreSession() {
    const saved = readStoredSession()
    if (!saved) return

    store.dispatch(sessionChecking())
    const { sessionGeneration } = store.getState().auth
    const res = await reLogin(saved)

    // Bỏ phản hồi cũ nếu trạng thái phiên đã đổi lúc đang chờ
    if (store.getState().auth.sessionGeneration !== sessionGeneration) return

    if (res.status === 'success') {
        store.dispatch(sessionStarted(res.data.username))
        return
    }

    clearStoredSession()
    socketClient.disconnect()
    const restoreError = res.error.kind === 'session'
        ? res.error.message
        : 'Không thể khôi phục phiên, vui lòng đăng nhập lại'
    store.dispatch(sessionCleared({ restoreError }))
}
