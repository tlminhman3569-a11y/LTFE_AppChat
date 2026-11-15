import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { ApiResult, AuthStatus, ConnectionStatus, ConversationRef } from '../../types/api'
import type { RecentConversation } from '../../types/user'
import { getRecentConversations } from '../../services/usersApi'
import {
    emptyConversationsState,
    finishConversationsLoad,
    startConversationsLoad,
} from '../../utils/conversationsStoreState'
import { sessionChecking, sessionCleared, sessionStarted } from './authSlice'

type ThunkState = {
    auth: {
        authStatus: AuthStatus
        connectionStatus: ConnectionStatus
        sessionGeneration: number
    }
    conversations: { loading: boolean }
}

export const refreshConversations = createAsyncThunk(
    'conversations/refresh',
    async (sessionGeneration: number, { getState }): Promise<ApiResult<RecentConversation[]>> => {
        const { auth } = getState() as ThunkState

        if (auth.authStatus !== 'authenticated' || auth.sessionGeneration !== sessionGeneration) {
            return {
                status: 'error',
                error: { kind: 'session', message: 'Phiên đăng nhập đã thay đổi.' },
            }
        }

        if (auth.connectionStatus !== 'connected') {
            return {
                status: 'error',
                error: { kind: 'connection', message: 'Chưa kết nối máy chủ, không thể làm mới danh sách.' },
            }
        }

        return getRecentConversations()
    },
    {
        condition: (_generation, { getState }) => {
            const { auth, conversations } = getState() as ThunkState
            return auth.authStatus === 'authenticated'
                && auth.sessionGeneration === _generation
                && !conversations.loading
        },
    },
)

const conversationsSlice = createSlice({
    name: 'conversations',
    initialState: emptyConversationsState(),
    reducers: {
        conversationVerified: (state, action: { payload: ConversationRef }) => {
            const conversation = action.payload
            if (state.verified.some(item => item.kind === conversation.kind && item.name === conversation.name)) return
            state.verified.unshift(conversation)
            if (!state.items.some(item => item.kind === conversation.kind && item.name === conversation.name)) {
                state.items.unshift(conversation)
            }
        },
    },
    extraReducers: builder => {
        builder
            .addCase(sessionChecking, () => emptyConversationsState())
            .addCase(sessionCleared, () => emptyConversationsState())
            .addCase(sessionStarted, () => emptyConversationsState())
            .addCase(refreshConversations.pending, (state, action) => {
                return startConversationsLoad(state, action.meta.arg, action.meta.requestId)
            })
            .addCase(refreshConversations.fulfilled, (state, action) => {
                return finishConversationsLoad(state, action.meta.arg, action.meta.requestId, action.payload)
            })
            .addCase(refreshConversations.rejected, (state, action) => {
                return finishConversationsLoad(state, action.meta.arg, action.meta.requestId, {
                    status: 'error',
                    error: { kind: 'connection', message: action.error.message || 'Không tải được danh sách hội thoại.' },
                })
            })
    },
})

export const { conversationVerified } = conversationsSlice.actions

export default conversationsSlice.reducer
