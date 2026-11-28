import type { RoomReadResult } from './room'
import type { ReactNode } from 'react'
import type {
    ApiResult,
    AuthStatus,
    ConnectionStatus,
    ConversationKind,
    ConversationRef,
} from './api'

export const maxMessageBytes = 1900

export type TextSize = 12 | 14 | 16 | 18 | 24

export interface TextRun {
    text: string
    bold: boolean
    italic: boolean
    size: TextSize
}

export interface RichMessageContent {
    version: 1
    clientMessageId: string
    runs: TextRun[]
}

export interface Message {
    id?: string | number
    name: string
    to: string
    kind: ConversationKind
    mes: string
    createAt?: string
    clientMessageId?: string
    deliveryStatus?: 'saved'
}

export interface OutgoingMessage extends Message {
    localId: string
    sentAt: number
    attempts?: number
    status: 'pending' | 'unconfirmed' | 'failed'
}

export interface PendingMessage {
    localId: string
    conversation: ConversationRef
    name: string
    content: RichMessageContent
    status: 'pending' | 'unconfirmed' | 'failed'
}

export interface HistoryPage {
    conversation: ConversationRef
    page: number
    messages: Message[]
    room?: RoomReadResult<Message>
}

export interface SendMessageInput {
    conversation: ConversationRef
    content: RichMessageContent
}

// Service mẫu của giai đoạn mock. API thật gửi qua sendText và hòa giải bằng Redux.
export interface ChatService {
    loadHistory(conversation: ConversationRef, page: number, currentUser: string | null): Promise<ApiResult<HistoryPage>>
    send(message: SendMessageInput): Promise<ApiResult<void>>
}

export interface ChatPageProps {
    conversation: ConversationRef | null
    currentUser: string | null
    authStatus: AuthStatus
    connectionStatus: ConnectionStatus
    sessionGeneration: number
}

export interface ComposerProps {
    imagePicker?: ReactNode
    conversation: ConversationRef
    draft: TextRun[]
    canSend: boolean
    onDraftChange: (conversation: ConversationRef, draft: TextRun[]) => void
    onSend: (conversation: ConversationRef, draft: TextRun[]) => void
}
