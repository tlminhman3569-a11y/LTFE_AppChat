import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { UserPresence } from '../../types/user'
import { checkOnline } from '../../services/usersApi'
import { sessionChecking, sessionCleared, sessionStarted } from './authSlice'

type AuthView = {
    auth: {
        authStatus: string
        connectionStatus: string
        sessionGeneration: number
    }
    presence: PresenceState
}

type CheckArgs = { user: string; sessionGeneration: number }

type PresenceState = {
    sessionGeneration: number | null
    byUser: Record<string, UserPresence>
    loading: Record<string, boolean>
    requestIds: Record<string, string>
}

function emptyPresence(): PresenceState {
    return { sessionGeneration: null, byUser: {}, loading: {}, requestIds: {} }
}

export const refreshPresence = createAsyncThunk(
    'presence/refresh',
    async ({ user }: CheckArgs) => {
        try {
            const result = await checkOnline(user)
            return { result, checkedAt: new Date().toISOString() }
        } catch {
            return {
                result: { status: 'error' as const, error: { kind: 'connection' as const, message: 'Không kiểm tra được online.' } },
                checkedAt: new Date().toISOString(),
            }
        }
    },
    {
        condition: ({ user, sessionGeneration }: CheckArgs, { getState }) => {
            const { auth, presence } = getState() as AuthView
            return !!user.trim()
                && auth.authStatus === 'authenticated'
                && auth.connectionStatus === 'connected'
                && auth.sessionGeneration === sessionGeneration
                && !presence.loading[user]
        },
    },
)

const presenceSlice = createSlice({
    name: 'presence',
    initialState: emptyPresence(),
    reducers: {},
    extraReducers: builder => {
        builder
            .addCase(sessionChecking, emptyPresence)
            .addCase(sessionCleared, emptyPresence)
            .addCase(sessionStarted, emptyPresence)
            .addCase(refreshPresence.pending, (state, action) => {
                const { user, sessionGeneration } = action.meta.arg
                if (state.sessionGeneration !== sessionGeneration) {
                    state.sessionGeneration = sessionGeneration
                    state.byUser = {}
                    state.loading = {}
                    state.requestIds = {}
                }
                state.loading[user] = true
                state.requestIds[user] = action.meta.requestId
            })
            .addCase(refreshPresence.fulfilled, (state, action) => {
                const { user, sessionGeneration } = action.meta.arg
                if (state.sessionGeneration !== sessionGeneration || state.requestIds[user] !== action.meta.requestId) return

                state.loading[user] = false
                delete state.requestIds[user]
                const { result, checkedAt } = action.payload
                state.byUser[user] = result.status === 'success'
                    ? result.data
                    : { status: 'unknown', checkedAt }
            })
            .addCase(refreshPresence.rejected, (state, action) => {
                const { user, sessionGeneration } = action.meta.arg
                if (state.sessionGeneration !== sessionGeneration || state.requestIds[user] !== action.meta.requestId) return

                state.loading[user] = false
                delete state.requestIds[user]
                state.byUser[user] = { status: 'unknown', checkedAt: state.byUser[user]?.checkedAt }
            })
    },
})

export function selectUserPresence(state: { presence: PresenceState }, user: string): UserPresence {
    return state.presence.byUser[user] ?? { status: 'unknown' }
}

export default presenceSlice.reducer
