import type { ApiResult } from '../types/api'
import type { RoomReadResult } from '../types/room'

export async function loadRoom(name: string, page: number): Promise<ApiResult<RoomReadResult>> {
    if (!name.trim()) {
        return {
            status: 'error',
            error: { kind: 'business', message: 'Tên phòng không được để trống' },
        }
    }

    if (!Number.isInteger(page) || page < 1) {
        return {
            status: 'error',
            error: { kind: 'business', message: 'Trang phải là số nguyên từ 1 trở lên' },
        }
    }

    return {
        status: 'error',
        error: { kind: 'connection', message: 'Chưa tích hợp đọc lịch sử phòng qua WebSocket (CV45)' },
    }
}