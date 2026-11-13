import type { ApiResult } from '../types/api'
import type { RecentConversation } from '../types/user'
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
