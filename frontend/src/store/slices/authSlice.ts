import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { AuthStatus, ConnectionStatus } from '../../types/api'

interface AuthState {
    authStatus: AuthStatus
    connectionStatus: ConnectionStatus
    currentUser: string | null
    sessionGeneration: number
    logoutNotConfirmed: boolean
    restoreError: string | null
}

const initialState: AuthState = {
    authStatus: 'unauthenticated',
    connectionStatus: 'disconnected',
    currentUser: null,
    sessionGeneration: 0,
    logoutNotConfirmed: false,
    restoreError: null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        sessionChecking(state) {
            state.restoreError = null
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
            state.restoreError = null
            state.logoutNotConfirmed = false
            state.authStatus = 'authenticated'
            state.currentUser = action.payload
            state.sessionGeneration += 1
        },
        sessionCleared(state, action: PayloadAction<{ logoutNotConfirmed?: boolean; restoreError?: string } | undefined>) {
            state.logoutNotConfirmed = action.payload?.logoutNotConfirmed ?? false
            state.restoreError = action.payload?.restoreError ?? null
            state.authStatus = 'unauthenticated'
            state.currentUser = null
            state.connectionStatus = 'disconnected'
            state.sessionGeneration += 1
        },
    },
})

export const { sessionChecking, connectionStatusChanged, sessionStarted, sessionCleared } = authSlice.actions
export default authSlice.reducer
