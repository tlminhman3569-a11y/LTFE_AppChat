import { useEffect } from 'react'
import AppRoutes from './routes'
import { watchSocketConnection } from './features/auth/reconnectSession.ts'

export default function App() {
    useEffect(watchSocketConnection, [])

    return <AppRoutes />
}
