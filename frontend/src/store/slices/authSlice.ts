import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { AuthStatus, ConnectionStatus } from '../../types/api'

interface AuthState {
    authStatus: AuthStatus
    connectionStatus: ConnectionStatus
    currentUser: string | null
    sessionGeneration: number
}

const initialState: AuthState = {
    authStatus: 'unauthenticated',
    connectionStatus: 'disconnected',
    currentUser: null,
    sessionGeneration: 0,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        sessionChecking(state) {
            state.authStatus = 'checking'
            state.currentUser = null
            state.connectionStatus = 'disconnected'
            state.sessionGeneration += 1
        },
        sessionStarted(state, action: PayloadAction<string>) {
            state.authStatus = 'authenticated'
            state.connectionStatus = 'connected'
            state.currentUser = action.payload
            state.sessionGeneration += 1
        },
        sessionCleared(state) {
            state.authStatus = 'unauthenticated'
            state.currentUser = null
            state.connectionStatus = 'disconnected'
            state.sessionGeneration += 1
        },
    },
})

export const { sessionChecking, sessionStarted, sessionCleared } = authSlice.actions
export default authSlice.reducer
