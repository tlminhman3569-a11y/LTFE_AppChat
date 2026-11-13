import { useAppSelector } from '../store/hooks'

export function useSocket() {
    const { authStatus, connectionStatus, reconnectCount } = useAppSelector(state => state.auth)

    return {
        connectionStatus,
        reconnectCount,
        canUseSocket: authStatus === 'authenticated' && connectionStatus === 'connected',
    }
}
