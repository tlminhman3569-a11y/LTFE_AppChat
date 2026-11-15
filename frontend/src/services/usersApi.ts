import type { ApiResult } from '../types/api'
import type { RecentConversation, UserPresence } from '../types/user'
import { parseGetUserListResponse } from '../utils/normalizeRecentConversations'
import { socketClient, SocketRequestError } from './socketClient'

export async function getRecentConversations(): Promise<ApiResult<RecentConversation[]>> {
    try {
        const response = await socketClient.request('GET_USER_LIST', {})
        return parseGetUserListResponse(response)
    } catch (error) {
        if (error instanceof SocketRequestError) {
            return {
                status: 'error',
                error: { kind: error.kind, message: 'Không tải được hội thoại. Vui lòng thử lại.' },
            }
        }

        return {
            status: 'error',
            error: { kind: 'connection', message: 'Không thể tải danh sách hội thoại qua kết nối hiện tại.' },
        }
    }
}

function readUserStatus(response: unknown, event: string): ApiResult<boolean> {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return { status: 'error', error: { kind: 'parse', message: 'Phản hồi kiểm tra người dùng không hợp lệ.' } }
    }

    const reply = response as Record<string, unknown>
    if (reply.event !== event) {
        return { status: 'error', error: { kind: 'parse', message: 'Phản hồi không đúng sự kiện kiểm tra người dùng.' } }
    }
    if (reply.status === 'error') {
        return { status: 'error', error: { kind: 'business', message: 'Máy chủ từ chối kiểm tra người dùng.' } }
    }
    if (reply.status !== 'success' || !reply.data || typeof reply.data !== 'object' || Array.isArray(reply.data)
        || typeof (reply.data as Record<string, unknown>).status !== 'boolean') {
        return { status: 'error', error: { kind: 'parse', message: 'Kết quả kiểm tra người dùng chưa hợp lệ.' } }
    }

    return { status: 'success', data: (reply.data as { status: boolean }).status }
}

function requestFailure(error: unknown): ApiResult<never> {
    if (error instanceof SocketRequestError) {
        return {
            status: error.wasSent ? 'unknown' : 'error',
            error: {
                kind: error.kind,
                message: error.wasSent ? 'Chưa xác định được kết quả kiểm tra. Vui lòng thử lại.' : 'Chưa kết nối được với máy chủ.',
            },
        }
    }
    return { status: 'error', error: { kind: 'connection', message: 'Không thể kiểm tra người dùng lúc này.' } }
}

export async function checkExists(user: string): Promise<ApiResult<boolean>> {
    const username = user.trim()
    if (!username || !/^[A-Za-z0-9_]+$/.test(username)) {
        return { status: 'error', error: { kind: 'business', message: 'Vui lòng nhập username chính xác (chữ, số hoặc dấu gạch dưới).' } }
    }

    try {
        const response = await socketClient.request('CHECK_USER_EXIST', { user: username })
        return readUserStatus(response, 'CHECK_USER_EXIST')
    } catch (error) {
        return requestFailure(error)
    }
}

export async function checkOnline(user: string): Promise<ApiResult<UserPresence>> {
    const username = user.trim()
    if (!username || !/^[A-Za-z0-9_]+$/.test(username)) {
        return { status: 'error', error: { kind: 'business', message: 'Tên người dùng không hợp lệ.' } }
    }

    try {
        const response = await socketClient.request('CHECK_USER_ONLINE', { user: username })
        const result = readUserStatus(response, 'CHECK_USER_ONLINE')
        if (result.status !== 'success') return result
        return {
            status: 'success',
            data: { status: result.data ? 'online' : 'offline', checkedAt: new Date().toISOString() },
        }
    } catch (error) {
        return requestFailure(error)
    }
}
