import { Navigate, Route, Routes } from 'react-router'
import { useAppSelector } from '../store/hooks'
import LoginPage from '../features/auth/LoginPage'
import ChatLayout from '../components/ChatLayout'
import ProtectedRoute from './ProtectedRoute'

export default function AppRoutes() {
    const { authStatus, sessionGeneration } = useAppSelector(state => state.auth)

    // Chặn cả trang đăng nhập trong lúc kiểm tra để không hiện phiên cũ.
    if (authStatus === 'checking') {
        return <p role="status" className="page-message">Đang kiểm tra phiên…</p>
    }

    const homePath = authStatus === 'authenticated' ? '/chat' : '/login'

    return (
        <Routes>
            <Route path="/login" element={authStatus === 'authenticated'
                ? <Navigate to="/chat" replace />
                : <LoginPage />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/chat" element={<ChatLayout key={sessionGeneration} />} />
            </Route>
            <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>
    )
}
