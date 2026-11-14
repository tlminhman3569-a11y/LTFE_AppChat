import type { ApiResult } from '../types/api'
import type { RecentConversation, UserPresence } from '../types/user'
import { parseGetUserListResponse } from '../utils/normalizeRecentConversations'
import { parseUserExists, parseUserOnline } from '../utils/parseUserChecks'
import { socketClient, SocketRequestError } from './socketClient'

function requestError(error: unknown, message: string): ApiResult<never> {
    if (error instanceof SocketRequestError && error.kind === 'timeout') {
        return { status: 'unknown', error: { kind: 'timeout', message: 'Hết thời gian chờ. Chưa xác định được kết quả.' } }
    }
    return { status: 'error', error: { kind: 'connection', message } }
}

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

export async function checkExists(user: string): Promise<ApiResult<boolean>> {
    if (!user.trim()) {
        return { status: 'error', error: { kind: 'business', message: 'Vui lòng nhập username đầy đủ.' } }
    }

    let response: Awaited<ReturnType<typeof socketClient.request>>
    try {
        response = await socketClient.request('CHAT_CHECK_USER_EXIST', { user: user.trim() })
    } catch (error) {
        return requestError(error, 'Không thể kiểm tra người dùng. Vui lòng thử lại.')
    }

    const result = parseUserExists(response)

    if (import.meta.env?.DEV) {
        try {
            console.info('[CV43][API]', {
                request: 'CHAT_CHECK_USER_EXIST',
                username: '[REDACTED]',
                responseEvent: response.event === 'CHECK_USER_EXIST'
                    ? 'CHECK_USER_EXIST' : 'unexpected-event',
                outcome: result.status === 'success'
                    ? (result.data ? 'exists' : 'not-found')
                    : result.status,
            })
        } catch {
        }
    }

    return result
}

export async function checkOnline(user: string): Promise<ApiResult<UserPresence>> {
    if (!user.trim()) {
        return { status: 'error', error: { kind: 'business', message: 'Vui lòng nhập username cần kiểm tra.' } }
    }

    try {
        const response = await socketClient.request('CHAT_CHECK_USER_ONLINE', { user: user.trim() })
        return parseUserOnline(response, new Date().toISOString())
    } catch (error) {
        return requestError(error, 'Không thể kiểm tra trạng thái online.')
    }
}
