import type { ApiResult } from '../types/api.ts'
import type { Message } from '../types/message.ts'
import type { RoomReadResult } from '../types/room.ts'
import type { RecentConversation, UserPresence } from '../types/user.ts'
import { createConversationKey } from '../utils/conversationKey.ts'
import { chatHistory } from './chat.ts'
import { conversationsSuccess } from './conversations.ts'
import { roomReadWithoutMetadata, rooms } from './rooms.ts'
import { users } from './users.ts'

export async function getRecentConversations(): Promise<ApiResult<RecentConversation[]>> {
    return conversationsSuccess
}

export async function checkExists(username: string): Promise<ApiResult<boolean>> {
    return { status: 'success', data: users.some(user => user.username === username) }
}

export async function checkOnline(username: string): Promise<ApiResult<UserPresence>> {
    const user = users.find(item => item.username === username)
    if (!user) {
        return { status: 'error', error: { kind: 'business', message: 'Không có tài khoản này trong fixture' } }
    }
    return { status: 'success', data: user.presence }
}

export async function loadRoom(name: string, page: number): Promise<ApiResult<RoomReadResult<Message>>> {
    if (!Number.isInteger(page) || page < 1) {
        return { status: 'error', error: { kind: 'business', message: 'Trang phải từ 1 trở lên' } }
    }

    const room = rooms.find(item => item.name === name)
    if (!room) {
        return { status: 'error', error: { kind: 'business', message: 'Không có dữ liệu phòng này trong fixture' } }
    }

    const key = createConversationKey({ kind: 'room', name })
    const messages = chatHistory[key]?.[page] ?? []

    if (name === 'nhom_hoc' && page === 2) {
        if (roomReadWithoutMetadata.status !== 'success') return roomReadWithoutMetadata

        return { status: 'success', data: { ...roomReadWithoutMetadata.data, messages } }
    }

    const data: RoomReadResult<Message> = {
        roomName: room.name,
        page,
        messages,
        ownerKnown: room.ownerKnown,
        membersKnown: room.membersKnown,
        membership: room.membership,
    }

    if (room.ownerKnown && room.owner !== undefined) data.owner = room.owner
    if (room.membersKnown && room.members !== undefined) data.members = room.members

    return { status: 'success', data }
}
