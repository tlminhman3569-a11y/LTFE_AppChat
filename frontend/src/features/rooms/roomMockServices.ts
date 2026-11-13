import type { ApiResult } from '../../types/api'
import type { Room } from '../../types/room'
import { rooms } from '../../fixtures/rooms.ts'

export type RoomMockMode = 'normal' | 'error' | 'unknown'

export async function mockCreateRoom(name: string, mode: RoomMockMode = 'normal'): Promise<ApiResult<Room>> {
    await new Promise(resolve => setTimeout(resolve, 300))

    if (!name.trim()) {
        return { status: 'error', error: { kind: 'business', message: 'Vui lòng nhập tên phòng.' } }
    }
    if (mode === 'unknown') {
        return { status: 'unknown', error: { kind: 'timeout', message: 'Chưa xác định được phòng đã tạo hay chưa.' } }
    }
    if (mode === 'error') {
        return { status: 'error', error: { kind: 'business', message: 'Không tạo được phòng (dữ liệu mô phỏng).' } }
    }
    if (rooms.some(room => room.name === name)) {
        return { status: 'error', error: { kind: 'business', message: 'Tên phòng đã tồn tại trong dữ liệu mẫu.' } }
    }

    return {
        status: 'success',
        data: { name, ownerKnown: false, membersKnown: false, membership: 'owner' },
    }
}

export async function mockJoinRoom(name: string, mode: RoomMockMode = 'normal'): Promise<ApiResult<Room>> {
    await new Promise(resolve => setTimeout(resolve, 300))

    if (!name.trim()) {
        return { status: 'error', error: { kind: 'business', message: 'Vui lòng nhập tên phòng.' } }
    }
    if (mode === 'unknown') {
        return { status: 'unknown', error: { kind: 'timeout', message: 'Chưa xác định được yêu cầu tham gia có thành công hay chưa.' } }
    }
    if (mode === 'error') {
        return { status: 'error', error: { kind: 'business', message: 'Không tham gia được phòng (dữ liệu mô phỏng).' } }
    }

    const room = rooms.find(item => item.name === name)
    if (!room) {
        return {
            status: 'error',
            error: { kind: 'business', message: 'Không có phòng này trong fixture. Điều này không chứng minh phòng không tồn tại trên hệ thống.' },
        }
    }

    return { status: 'success', data: { ...room, membership: 'member' } }
}
