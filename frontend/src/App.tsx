import { useEffect } from 'react'
import AppRoutes from './routes'
import { socketClient } from './services/socketClient'
import { useAppDispatch } from './store/hooks'
import { connectionStatusChanged } from './store/slices/authSlice'

export default function App() {
    const dispatch = useAppDispatch()

    useEffect(() => {
        return socketClient.subscribeStatus(status => dispatch(connectionStatusChanged(status)))
    }, [dispatch])

    return <AppRoutes />
}
