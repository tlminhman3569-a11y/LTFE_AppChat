import type { ApiError, ApiResult, ConversationRef } from './api'

export type Membership = 'unknown' | 'member' | 'owner' | 'left'

export interface RoomConversationRef extends ConversationRef {
    kind: 'room'
}

export interface Room {
    name: string
    owner?: string
    ownerKnown: boolean
    members?: string[]
    membersKnown: boolean
    membership: Membership
}

export interface RoomReadResult<TMessage = unknown> {
    roomName: string
    page: number
    messages: TMessage[]
    owner?: string
    ownerKnown: boolean
    members?: string[]
    membersKnown: boolean
    membership: Membership
}

export interface RoomActionsProps {
    room: Room
    currentUser: string | null
    pending: boolean
    onShowMembers: (conversation: RoomConversationRef) => void
    onRequestLeave: (conversation: RoomConversationRef) => void
}

export interface MemberListProps {
    room: Room
    currentUser: string | null
    loading: boolean
    error: ApiError | null
    onRefresh: (conversation: RoomConversationRef) => void
    onClose: () => void
}

export interface RoomsService {
    loadRoom(name: string, page: number): Promise<ApiResult<RoomReadResult>>
    createRoom(name: string): Promise<ApiResult<Room>>
    joinRoom(name: string): Promise<ApiResult<Room>>
    leaveRoom(name: string): Promise<ApiResult<{ roomName: string }>>
}
