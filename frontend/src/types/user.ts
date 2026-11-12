import type { ApiResult, ConversationRef } from './api'

export type PresenceStatus = 'online' | 'offline' | 'unknown'

export interface UserPresence {
    status: PresenceStatus
    checkedAt?: string
}

export interface User {
    username: string
    presence: UserPresence
}

export interface RecentConversation extends ConversationRef {
    actionTime?: string
}

export type OnSelectConversation = (conversation: ConversationRef) => void

export interface ConversationListProps {
    conversations: RecentConversation[]
    selectedConversation: ConversationRef | null
    onSelectConversation: OnSelectConversation
}

export interface UsersService {
    getRecentConversations(): Promise<ApiResult<RecentConversation[]>>
    checkExists(user: string): Promise<ApiResult<boolean>>
    checkOnline(user: string): Promise<ApiResult<UserPresence>>
}
