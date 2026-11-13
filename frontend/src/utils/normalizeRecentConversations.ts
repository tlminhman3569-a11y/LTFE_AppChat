import type { ApiResult } from '../types/api'
import type { RecentConversation } from '../types/user'

function parseError(message: string): ApiResult<RecentConversation[]> {
    return { status: 'error', error: { kind: 'parse', message } }
}

export function normalizeRecentConversations(value: unknown): ApiResult<RecentConversation[]> {
    if (!Array.isArray(value)) {
        return parseError('Danh sách hội thoại trả về không phải mảng.')
    }

    const conversations: RecentConversation[] = []
    const seen = new Set<string>()

    for (const [index, entry] of value.entries()) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            return parseError(`Hội thoại thứ ${index + 1} không hợp lệ.`)
        }

        const item = entry as Record<string, unknown>
        if (typeof item.name !== 'string' || !item.name.trim() || (item.type !== 0 && item.type !== 1)) {
            return parseError(`Tên hoặc loại hội thoại thứ ${index + 1} không hợp lệ.`)
        }

        if (item.actionTime != null && typeof item.actionTime !== 'string') {
            return parseError(`Thời gian hội thoại thứ ${index + 1} không hợp lệ.`)
        }

        const conversation: RecentConversation = {
            kind: item.type === 0 ? 'people' : 'room',
            name: item.name,
        }

        if (typeof item.actionTime === 'string' && item.actionTime.trim()) {
            conversation.actionTime = item.actionTime
        }

        const key = JSON.stringify([conversation.kind, conversation.name])
        if (!seen.has(key)) {
            seen.add(key)
            conversations.push(conversation)
        }
    }

    return { status: 'success', data: conversations }
}

export function parseGetUserListResponse(response: unknown): ApiResult<RecentConversation[]> {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return parseError('Phản hồi GET_USER_LIST không hợp lệ.')
    }

    const data = response as Record<string, unknown>
    if (data.event !== 'GET_USER_LIST') {
        return parseError('Phản hồi không đúng sự kiện GET_USER_LIST.')
    }

    if (data.status === 'error') {
        return {
            status: 'error',
            error: { kind: 'business', message: 'Máy chủ từ chối tải danh sách hội thoại.' },
        }
    }

    if (data.status !== 'success') {
        return parseError('GET_USER_LIST chưa có kết quả hợp lệ.')
    }

    return normalizeRecentConversations(data.data)
}
