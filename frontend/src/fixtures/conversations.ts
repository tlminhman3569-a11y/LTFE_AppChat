import type { ApiResult } from '../types/api'
import type { RecentConversation } from '../types/user'

export const recentConversations: RecentConversation[] = [
    { kind: 'people', name: 'minh_an', actionTime: '2026-11-05 08:02:00' },
    { kind: 'room', name: 'minh_an', actionTime: '2026-11-05 08:01:00' },
    { kind: 'people', name: 'kiet_demo', actionTime: '2026-11-05 07:59:00' },
    { kind: 'room', name: 'nhom_hoc', actionTime: '2026-11-05 07:55:00' },
    { kind: 'room', name: 'nhom_du_an', actionTime: '2026-11-05 07:50:00' },
    { kind: 'room', name: 'phong_khong_ro' },
]

export const conversationsSuccess: ApiResult<RecentConversation[]> = {
    status: 'success',
    data: recentConversations,
}

export const conversationsEmpty: ApiResult<RecentConversation[]> = {
    status: 'success',
    data: [],
}

export const conversationsError: ApiResult<RecentConversation[]> = {
    status: 'error',
    error: { kind: 'connection', message: 'Không tải được hội thoại mẫu' },
}

export const conversationsUnknown: ApiResult<RecentConversation[]> = {
    status: 'unknown',
    error: { kind: 'timeout', message: 'Chưa rõ kết quả tải hội thoại mẫu' },
}
