import { logout } from '../../services/authApi'
import { store } from '../../store'
import { sessionCleared } from '../../store/slices/authSlice'
import { clearLeaveRequests } from '../rooms/leaveRoomRequestState'
import { clearRoomRequests } from '../rooms/roomRequestState'

export async function endSession() {
    const { authStatus, sessionGeneration } = store.getState().auth
    if (authStatus !== 'authenticated') return

    const res = await logout()

    // Nếu phiên đã đổi trong lúc chờ thì giữ nguyên dữ liệu của phiên mới
    if (store.getState().auth.sessionGeneration !== sessionGeneration) return

    store.dispatch(sessionCleared({ logoutNotConfirmed: res.status !== 'success' }))
    clearRoomRequests()
    clearLeaveRequests()
}
