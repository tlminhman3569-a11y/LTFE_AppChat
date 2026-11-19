import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { matchesOutgoing } from '../../utils/matchesOutgoing'
import { loadHistory } from '../../services/chatApi'
import type { AuthStatus, ConnectionStatus, ConversationRef } from '../../types/api'
import type { Message, OutgoingMessage } from '../../types/message'
import { createConversationKey } from '../../utils/conversationKey'
import { sessionChecking, sessionCleared, sessionReconnected, sessionStarted } from './authSlice'

interface History {
    messages: Message[]
    nextPage: number
    hasOlder: boolean
    error: string
    unread?: number
    requestId?: string
    reconcileRequestId?: string
    reconcileError?: string
    reconcileTailIndex?: number
    outgoing?: OutgoingMessage[]
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

export const reconcileOutgoing = createAsyncThunk(
    'messages/reconcileOutgoing',
    async ({ conversation, sessionGeneration }: Omit<HistoryRequest, 'page'>, { getState }) => {
        const { currentUser } = (getState() as HistoryStore).auth
        const first = await loadHistory(conversation, 1, currentUser)
        if (first.status !== 'success' || first.data.messages.length === 0) return first
        if ((getState() as HistoryStore).auth.sessionGeneration !== sessionGeneration) {
            return { status: 'error' as const, error: { kind: 'session' as const, message: 'Phiên đã thay đổi.' } }
        }
        const second = await loadHistory(conversation, 2, currentUser)
        return {
            status: 'success' as const,
            data: { ...first.data, messages: [...first.data.messages,
                ...(second.status === 'success' ? second.data.messages : [])] },
        }
    },
    {
        condition: ({ conversation, sessionGeneration }, { getState }) => {
            const { auth, messages } = getState() as HistoryStore
            const history = messages[createConversationKey(conversation)]
            return auth.authStatus === 'authenticated' && auth.connectionStatus === 'connected'
                && auth.sessionGeneration === sessionGeneration && !history?.reconcileRequestId
                && Boolean(history?.outgoing?.length)
        },
    },
)

function reconcilePending(history: History, records: Message[]) {
    history.outgoing = history.outgoing?.filter(pending =>
        !records.some(record => matchesOutgoing(pending, record)),
    )
}
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

function sameStoredMessage(first: Message, second: Message) {
    if (first.id != null && second.id != null) return String(first.id) === String(second.id)
    return matchesOutgoing(first, second)
}

function mergeConfirmed(history: History, records: Message[], previousTailIndex: number | undefined) {
    const ordered = mergeHistory(records, [])
    for (let index = 0; index < ordered.length; index++) {
        const record = ordered[index]
        const existingIndex = history.messages.findIndex(message => sameStoredMessage(message, record))
        if (existingIndex >= 0) {
            const existing = history.messages[existingIndex]
            history.messages[existingIndex] = {
                ...existing, ...record,
                id: record.id ?? existing.id,
                createAt: record.createAt ?? existing.createAt,
            }
            continue
        }
        if (!history.outgoing?.some(pending => matchesOutgoing(pending, record))) continue

        // Đặt bản lưu theo các tin lân cận trong trang, giữ nguyên vị trí tin realtime mới.
        let insertAt = -1
        for (let next = index + 1; next < ordered.length; next++) {
            insertAt = history.messages.findIndex(message => sameStoredMessage(message, ordered[next]))
            if (insertAt >= 0) break
        }
        if (insertAt < 0) {
            for (let previous = index - 1; previous >= 0; previous--) {
                const anchor = history.messages.findIndex(message => sameStoredMessage(message, ordered[previous]))
                if (anchor >= 0) {
                    insertAt = anchor + 1
                    break
                }
            }
        }
        if (insertAt < 0) {
            insertAt = previousTailIndex == null
                ? history.messages.length
                : Math.min(previousTailIndex + 1, history.messages.length)
        }
        history.messages.splice(insertAt, 0, record)
    }
}
const messagesSlice = createSlice({
    name: 'messages',
    initialState: {} as MessagesState,
    reducers: {
        outgoingQueued(state, { payload }: PayloadAction<{ conversation: ConversationRef; message: OutgoingMessage }>) {
            const history = state[createConversationKey(payload.conversation)] ??= {
                messages: [], nextPage: 1, hasOlder: true, error: '',
            }
            const outgoing = history.outgoing ??= []
            const existingIndex = outgoing.findIndex(message => message.localId === payload.message.localId)
            if (existingIndex < 0) outgoing.push(payload.message)
            else if (matchesOutgoing(outgoing[existingIndex], payload.message)) {
                const attempts = Math.max(payload.message.attempts ?? 1, (outgoing[existingIndex].attempts ?? 1) + 1)
                outgoing[existingIndex] = { ...payload.message, attempts }
            }
        },
        outgoingSendFailed(state, { payload }: PayloadAction<{ conversation: ConversationRef; localId: string }>) {
            const message = state[createConversationKey(payload.conversation)]?.outgoing?.find(
                item => item.localId === payload.localId,
            )
            if (message) message.status = (message.attempts ?? 1) > 1 ? 'unconfirmed' : 'failed'
        },
        outgoingErrorReceived(state, { payload }: PayloadAction<Message>) {
            const key = createConversationKey({ kind: payload.kind, name: payload.to })
            const message = state[key]?.outgoing?.find(item => matchesOutgoing(item, payload))
            if (message) message.status = (message.attempts ?? 1) > 1 ? 'unconfirmed' : 'failed'
        },
        outgoingExpired(state, { payload }: PayloadAction<number>) {
            for (const history of Object.values(state)) {
                for (const message of history?.outgoing ?? []) {
                    if (message.status === 'pending' && message.sentAt <= payload) message.status = 'unconfirmed'
                }
            }
        },
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
                    if (history?.error && history.nextPage === 1 && history.messages.length === 0 && !history.outgoing?.length) delete state[key]
                }
            })
            .addCase(reconcileOutgoing.pending, (state, { meta }) => {
                const history = state[createConversationKey(meta.arg.conversation)]
                if (history) {
                    history.reconcileRequestId = meta.requestId
                    history.reconcileError = ''
                    history.reconcileTailIndex = history.messages.length - 1
                }
            })
            .addCase(reconcileOutgoing.fulfilled, (state, { meta, payload }) => {
                const history = state[createConversationKey(meta.arg.conversation)]
                if (history?.reconcileRequestId !== meta.requestId) return
                delete history.reconcileRequestId
                if (payload.status !== 'success') {
                    history.reconcileError = payload.error.message
                    delete history.reconcileTailIndex
                    return
                }
                history.error = ''
                history.reconcileError = ''
                mergeConfirmed(history, payload.data.messages, history.reconcileTailIndex)
                delete history.reconcileTailIndex
                reconcilePending(history, payload.data.messages)
            })
            .addCase(reconcileOutgoing.rejected, (state, { meta }) => {
                const history = state[createConversationKey(meta.arg.conversation)]
                if (history?.reconcileRequestId === meta.requestId) {
                    delete history.reconcileRequestId
                    delete history.reconcileTailIndex
                    history.reconcileError = 'Vui lòng thử đối chiếu lại khi kết nối ổn định.'
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
                reconcilePending(history, messages)
                history.hasOlder = messages.length > 0
                if (history.hasOlder) {
                    const merged = mergeHistory(messages, history.messages)
                    if (history.reconcileTailIndex != null) {
                        history.reconcileTailIndex += merged.length - history.messages.length
                    }
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

export const { messageReceived, markViewed, outgoingQueued, outgoingSendFailed, outgoingErrorReceived, outgoingExpired } = messagesSlice.actions

export function selectUnreadCount(state: { messages: MessagesState }, key: string) {
    return state.messages[key]?.unread ?? 0
}

export default messagesSlice.reducer
