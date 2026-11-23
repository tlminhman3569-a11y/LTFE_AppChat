import type { ApiResult } from '../types/api'
import type { RecentConversation } from '../types/user'

function parseError(message: string): ApiResult<RecentConversation[]> {
    return { status: 'error', error: { kind: 'parse', message } }
}

export type RecentConversationsResult = ApiResult<RecentConversation[]> & { warning?: string }

export function normalizeRecentConversations(value: unknown): RecentConversationsResult {
    if (!Array.isArray(value)) {
        return parseError('Danh sách hội thoại trả về không phải mảng.')
    }

    const conversations: RecentConversation[] = []
    const seen = new Set<string>()
    let invalidCount = 0

    for (const entry of value) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            invalidCount += 1
            continue
        }

        const item = entry as Record<string, unknown>
        if (typeof item.name !== 'string' || !item.name.trim() || (item.type !== 0 && item.type !== 1)) {
            invalidCount += 1
            continue
        }

        if (item.actionTime != null && typeof item.actionTime !== 'string') {
            invalidCount += 1
            continue
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

    if (invalidCount > 0 && conversations.length === 0) {
        return parseError(`Danh sách hội thoại có ${invalidCount} mục không hợp lệ và không có mục hợp lệ để hiển thị.`)
    }

    if (invalidCount > 0) {
        return {
            status: 'success',
            data: conversations,
            warning: `Máy chủ trả về ${invalidCount} mục hội thoại không hợp lệ; đã bỏ qua và vẫn hiển thị ${conversations.length} hội thoại hợp lệ.`,
        }
    }

    return { status: 'success', data: conversations }
}

export function parseGetUserListResponse(response: unknown): RecentConversationsResult {
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
