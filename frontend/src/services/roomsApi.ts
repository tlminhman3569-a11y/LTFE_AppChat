import type { ApiResult } from '../types/api'
import type { Room, RoomReadResult } from '../types/room'
import { socketClient, SocketRequestError } from './socketClient'

function readRoomName(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null
}

function readMembers(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null

    const members: string[] = []
    for (const entry of value) {
        const member = typeof entry === 'string'
            ? readRoomName(entry)
            : entry && typeof entry === 'object' && !Array.isArray(entry)
                ? readRoomName((entry as Record<string, unknown>).name)
                : null
        if (!member) return null
        if (!members.includes(member)) members.push(member)
    }
    return members
}

function readRoomResponse(response: unknown, event: 'CREATE_ROOM' | 'JOIN_ROOM', requestedName: string): ApiResult<Room> {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Phản hồi phòng không hợp lệ. Cần kiểm tra lại trước khi thao tác tiếp.' } }
    }

    const reply = response as Record<string, unknown>
    if (reply.event !== event) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Phản hồi không khớp thao tác phòng. Chưa xác định được kết quả.' } }
    }

    if (reply.status === 'error') {
        const data = reply.data && typeof reply.data === 'object' && !Array.isArray(reply.data)
            ? reply.data as Record<string, unknown>
            : null
        const message = typeof reply.mes === 'string' ? reply.mes
            : typeof reply.data === 'string' ? reply.data
                : typeof data?.mes === 'string' ? data.mes : ''
        return {
            status: 'error',
            error: {
                kind: 'business',
                message: message.trim().slice(0, 300) || (event === 'CREATE_ROOM'
                    ? 'Máy chủ từ chối tạo phòng. Hãy kiểm tra tên phòng.'
                    : 'Máy chủ từ chối tham gia phòng. Hãy kiểm tra tên phòng.'),
            },
        }
    }

    if (reply.status !== 'success' || !reply.data || typeof reply.data !== 'object' || Array.isArray(reply.data)) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Chưa có xác nhận thành công hợp lệ từ máy chủ.' } }
    }

    const data = reply.data as Record<string, unknown>
    const actualName = readRoomName(data.name)
    if (actualName !== requestedName) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Phản hồi thiếu tên phòng hoặc không khớp tên yêu cầu. Cần kiểm tra lại.' } }
    }

    const owner = readRoomName(data.own) ?? readRoomName(data.owner)
    const rawMembers = 'userList' in data ? data.userList : 'user' in data ? data.user : data.members
    const members = readMembers(rawMembers)
    const room: Room = {
        name: actualName,
        ownerKnown: owner !== null,
        membersKnown: members !== null,
        membership: event === 'CREATE_ROOM' ? 'owner' : 'member',
    }
    if (owner !== null) room.owner = owner
    if (members !== null) room.members = members
    return { status: 'success', data: room }
}

async function changeRoom(event: 'CREATE_ROOM' | 'JOIN_ROOM', name: string): Promise<ApiResult<Room>> {
    const roomName = name.trim()
    if (!roomName) {
        return { status: 'error', error: { kind: 'business', message: 'Tên phòng không được để trống.' } }
    }

    try {
        const response = await socketClient.request(event, { name: roomName })
        return readRoomResponse(response, event, roomName)
    } catch (error) {
        if (error instanceof SocketRequestError) {
            const message = error.kind === 'timeout' ? 'Hết thời gian chờ xác nhận.' : 'Kết nối bị gián đoạn.'
            if (error.wasSent) {
                return { status: 'unknown', error: { kind: error.kind, message: `${message} Chưa rõ máy chủ đã thực hiện thao tác phòng hay chưa.` } }
            }
            return { status: 'error', error: { kind: error.kind, message: `${message} Chưa gửi được yêu cầu phòng.` } }
        }
        return { status: 'error', error: { kind: 'connection', message: 'Không thể gửi yêu cầu phòng qua WebSocket.' } }
    }
}

export function createRoom(name: string): Promise<ApiResult<Room>> {
    return changeRoom('CREATE_ROOM', name)
}

export function joinRoom(name: string): Promise<ApiResult<Room>> {
    return changeRoom('JOIN_ROOM', name)
}

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
