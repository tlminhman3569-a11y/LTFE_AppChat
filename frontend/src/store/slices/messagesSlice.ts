import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { loadHistory } from '../../services/chatApi'
import type { AuthStatus, ConnectionStatus, ConversationRef } from '../../types/api'
import type { Message } from '../../types/message'
import { createConversationKey } from '../../utils/conversationKey'
import { sessionChecking, sessionCleared, sessionReconnected, sessionStarted } from './authSlice'

interface History {
    messages: Message[]
    nextPage: number
    hasOlder: boolean
    error: string
    unread?: number
    requestId?: string
}

interface HistoryRequest {
    conversation: ConversationRef
    page: number
    sessionGeneration: number
}

type MessagesState = Partial<Record<string, History>>
type HistoryStore = {
    auth: {
        authStatus: AuthStatus
        connectionStatus: ConnectionStatus
        currentUser: string | null
        sessionGeneration: number
    }
    messages: MessagesState
}

export const fetchHistoryPage = createAsyncThunk(
    'messages/fetchHistoryPage',
    async ({ conversation, page }: HistoryRequest, { getState }) => {
        const { currentUser } = (getState() as HistoryStore).auth
        return loadHistory(conversation, page, currentUser)
    },
    {
        condition: ({ conversation, page, sessionGeneration }, { getState }) => {
            const { auth, messages } = getState() as HistoryStore
            const history = messages[createConversationKey(conversation)]
            return auth.authStatus === 'authenticated'
                && auth.connectionStatus === 'connected'
                && auth.sessionGeneration === sessionGeneration
                && !history?.requestId
                && (history?.hasOlder ?? true)
                && page === (history?.nextPage ?? 1)
        },
    },
)

function mergeHistory(older: Message[], existing: Message[]) {
    const seen = new Set(existing.flatMap(message => message.id == null ? [] : [String(message.id)]))
    const unique = older.filter(message => {
        if (message.id == null) return true
        const id = String(message.id)
        if (seen.has(id)) return false
        seen.add(id)
        return true
    })
    return [...unique.reverse(), ...existing]
}

const messagesSlice = createSlice({
    name: 'messages',
    initialState: {} as MessagesState,
    reducers: {
        messageReceived(state, action: PayloadAction<{ conversation: ConversationRef; message: Message; viewed: boolean }>) {
            const { conversation, message, viewed } = action.payload
            const key = createConversationKey(conversation)
            const history = state[key] ??= { messages: [], nextPage: 1, hasOlder: true, error: '' }
            if (message.id != null && history.messages.some(item => item.id != null && String(item.id) === String(message.id))) return
            // Tin chưa có ID có thể xuất hiện lại trong trang đầu.
            if (message.id != null || history.nextPage > 1 || !history.hasOlder) {
                history.messages.push(message)
            }
            if (!viewed) history.unread = (history.unread ?? 0) + 1
        },
        markViewed(state, action: PayloadAction<string>) {
            const history = state[action.payload]
            if (history?.unread) history.unread = 0
        },
    },
    extraReducers: builder => {
        builder
            .addCase(sessionChecking, () => ({}))
            .addCase(sessionStarted, () => ({}))
            .addCase(sessionCleared, () => ({}))
            .addCase(sessionReconnected, state => {
                for (const [key, history] of Object.entries(state)) {
                    if (history?.error && history.nextPage === 1 && history.messages.length === 0) delete state[key]
                }
            })
            .addCase(fetchHistoryPage.pending, (state, { meta }) => {
                const key = createConversationKey(meta.arg.conversation)
                const history = state[key] ??= { messages: [], nextPage: 1, hasOlder: true, error: '' }
                history.requestId = meta.requestId
                history.error = ''
            })
            .addCase(fetchHistoryPage.fulfilled, (state, { meta, payload }) => {
                const history = state[createConversationKey(meta.arg.conversation)]
                if (history?.requestId !== meta.requestId) return
                delete history.requestId
                if (payload.status !== 'success') {
                    history.error = payload.error.message
                    return
                }
                const { messages } = payload.data
                history.hasOlder = messages.length > 0
                if (history.hasOlder) {
                    const merged = mergeHistory(messages, history.messages)
                    if (merged.length !== history.messages.length) history.messages = merged
                    history.nextPage = meta.arg.page + 1
                }
            })
            .addCase(fetchHistoryPage.rejected, (state, { meta }) => {
                const history = state[createConversationKey(meta.arg.conversation)]
                if (history?.requestId !== meta.requestId) return
                delete history.requestId
                history.error = 'Không tải được lịch sử tin nhắn.'
            })
    },
})

export const { messageReceived, markViewed } = messagesSlice.actions

export function selectUnreadCount(state: { messages: MessagesState }, key: string) {
    return state.messages[key]?.unread ?? 0
}

export default messagesSlice.reducer
