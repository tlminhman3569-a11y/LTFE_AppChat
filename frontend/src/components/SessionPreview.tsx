import { Link } from 'react-router'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { sessionChecking, sessionStarted, sessionCleared } from '../store/slices/authSlice'

export default function SessionPreview() {
    const dispatch = useAppDispatch()
    const authStatus = useAppSelector(state => state.auth.authStatus)

    return (
        <aside className="session-preview" aria-label="Thử phiên mẫu CV03">
            <strong>CV03 · Phiên mẫu, chưa kết nối API</strong>
            <span>Trạng thái: {authStatus}</span>
            <div className="preview-actions">
                <button onClick={() => dispatch(sessionChecking())}>Thử đang kiểm tra</button>
                <button onClick={() => dispatch(sessionStarted('man_mau'))}>Dùng tài khoản mẫu</button>
                <button onClick={() => dispatch(sessionCleared())}>Xóa phiên mẫu</button>
                <Link to="/login">/login</Link>
                <Link to="/chat">/chat</Link>
            </div>
            <small>Tải lại trang sẽ xóa phiên mẫu. Các nút thử chỉ hiện khi chạy bản phát triển.</small>
        </aside>
    )
}
