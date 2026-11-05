/**
 * Kiểu dữ liệu nội bộ của frontend
 * Không phải toàn bộ cấu trúc response thô của máy chủ
 */

export type ConversationKind = 'people' | 'room'

export interface ConversationRef {
    kind: ConversationKind
    name: string
}

export type ConversationKey = string

export type ConnectionStatus =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'reconnecting'

export type AuthStatus =
    | 'checking'
    | 'authenticated'
    | 'unauthenticated'

export type ApiErrorKind =
    | 'business'
    | 'connection'
    | 'session'
    | 'parse'
    | 'timeout'

export interface ApiError {
    kind: ApiErrorKind
    message: string
}

/**
 * Timeout hoặc mất kết nối sau khi phát lệnh ghi
 * không chứng minh máy chủ chưa thực hiện tác vụ
 */
export type ApiResult<T> =
    | {
    status: 'success'
    data: T
}
    | {
    status: 'error'
    error: ApiError
}
    | {
    status: 'unknown'
    error: ApiError
}

/**
 * Thông tin frontend dùng để đối chiếu tác vụ
 * Không tự thêm các trường này vào request máy chủ
 */
export interface RequestContext {
    sessionGeneration: number
    connectionGeneration: number
    conversationKey?: ConversationKey
    page?: number
}

/**
 * connected chỉ có nghĩa socket đã kết nối, không có nghĩa đã đăng nhập
 * Muốn cho gửi tin còn phải kiểm tra phiên và quyền phòng
 */