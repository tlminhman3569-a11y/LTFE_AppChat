import type { ApiResult } from '../types/api'
import type { User } from '../types/user'

export const currentUser = 'khoi_demo'

export const users: User[] = [
    { username: 'khoi_demo', presence: { status: 'online', checkedAt: '2026-11-05 08:00:00' } },
    { username: 'man_demo', presence: { status: 'online', checkedAt: '2026-11-05 08:01:00' } },
    { username: 'kiet_demo', presence: { status: 'offline', checkedAt: '2026-11-05 08:02:00' } },
    { username: 'minh_an', presence: { status: 'unknown' } },
]

export const usersEmpty: ApiResult<User[]> = { status: 'success', data: [] }

export const usersError: ApiResult<User[]> = {
    status: 'error',
    error: { kind: 'connection', message: 'Không tải được danh sách người dùng mẫu' },
}
