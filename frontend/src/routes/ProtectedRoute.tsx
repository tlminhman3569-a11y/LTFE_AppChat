import { Navigate, Outlet } from 'react-router'
import { useAppSelector } from '../store/hooks'

export default function ProtectedRoute() {
    const authStatus = useAppSelector(state => state.auth.authStatus)

    if (authStatus === 'checking') {
        return <p role="status" className="page-message">Đang kiểm tra phiên…</p>
    }

    if (authStatus !== 'authenticated') {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}
