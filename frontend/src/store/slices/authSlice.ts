import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { AuthStatus, ConnectionStatus } from '../../types/api'

interface AuthState {
    authStatus: AuthStatus
    connectionStatus: ConnectionStatus
    currentUser: string | null
    sessionGeneration: number
    logoutNotConfirmed: boolean
}

const initialState: AuthState = {
    authStatus: 'unauthenticated',
    connectionStatus: 'disconnected',
    currentUser: null,
    sessionGeneration: 0,
    logoutNotConfirmed: false,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        sessionChecking(state) {
            state.logoutNotConfirmed = false
            state.authStatus = 'checking'
            state.currentUser = null
            state.connectionStatus = 'disconnected'
            state.sessionGeneration += 1
        },
        connectionStatusChanged(state, action: PayloadAction<ConnectionStatus>) {
            state.connectionStatus = action.payload
        },
        sessionStarted(state, action: PayloadAction<string>) {
            state.logoutNotConfirmed = false
            state.authStatus = 'authenticated'
            state.currentUser = action.payload
            state.sessionGeneration += 1
        },
        sessionCleared(state, action: PayloadAction<boolean | undefined>) {
            state.logoutNotConfirmed = action.payload === true
            state.authStatus = 'unauthenticated'
            state.currentUser = null
            state.connectionStatus = 'disconnected'
            state.sessionGeneration += 1
        },
    },
})

export const { sessionChecking, connectionStatusChanged, sessionStarted, sessionCleared } = authSlice.actions
export default authSlice.reducer
