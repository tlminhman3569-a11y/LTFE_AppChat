import type { ApiResult } from '../types/api'
import type { Room, RoomReadResult } from '../types/room'
import type { Message } from '../types/message'
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

function invalidRoomRead(message: string): ApiResult<never> {
    return { status: 'error', error: { kind: 'parse', message } }
}

function readRoomMessage(value: unknown, roomName: string): Message | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const item = value as Record<string, unknown>
    if (item.type !== 1 || !readRoomName(item.name) || item.to !== roomName || typeof item.mes !== 'string') return null

    const message: Message = { kind: 'room', name: item.name as string, to: roomName, mes: item.mes }
    if (typeof item.id === 'string' || typeof item.id === 'number') message.id = item.id
    if (typeof item.createAt === 'string') message.createAt = item.createAt
    return message
}

function readRoomHistory(response: unknown, roomName: string, page: number): ApiResult<RoomReadResult<Message>> {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return invalidRoomRead('Phản hồi đọc phòng không hợp lệ.')
    }
    const reply = response as Record<string, unknown>
    if (reply.event !== 'GET_ROOM_CHAT_MES') return invalidRoomRead('Sự kiện phản hồi đọc phòng không khớp.')

    if (reply.status === 'error') {
        const data = reply.data && typeof reply.data === 'object' && !Array.isArray(reply.data)
            ? reply.data as Record<string, unknown> : null
        const message = typeof reply.mes === 'string' ? reply.mes
            : typeof reply.data === 'string' ? reply.data
                : typeof data?.mes === 'string' ? data.mes : ''
        return { status: 'error', error: { kind: 'business', message: message.trim().slice(0, 300) || 'Máy chủ từ chối đọc phòng.' } }
    }

    if (reply.status !== 'success' || !reply.data || typeof reply.data !== 'object' || Array.isArray(reply.data)) {
        return invalidRoomRead('Phản hồi đọc phòng không có dữ liệu hợp lệ.')
    }

    const data = reply.data as Record<string, unknown>
    if (readRoomName(data.name) !== roomName || ('page' in data && data.page !== page)) {
        return invalidRoomRead('Tên phòng hoặc trang trong phản hồi không khớp yêu cầu.')
    }

    const rawMessages = 'chatData' in data ? data.chatData : data.chatMess
    if (!Array.isArray(rawMessages)) return invalidRoomRead('Phản hồi không có mảng lịch sử phòng hợp lệ.')
    const messages: Message[] = []
    for (const item of rawMessages) {
        const message = readRoomMessage(item, roomName)
        if (!message) return invalidRoomRead('Phản hồi chứa tin nhắn phòng không hợp lệ.')
        messages.push(message)
    }

    const rawOwner = 'own' in data ? data.own : data.owner
    if (rawOwner != null && typeof rawOwner !== 'string') return invalidRoomRead('Trường chủ phòng không hợp lệ.')
    const owner = readRoomName(rawOwner)
    const hasMembers = 'userList' in data || 'user' in data || 'members' in data
    const rawMembers = 'userList' in data ? data.userList : 'user' in data ? data.user : data.members
    const members = hasMembers ? readMembers(rawMembers) : null
    if (hasMembers && members === null) return invalidRoomRead('Danh sách thành viên phòng không hợp lệ.')

    const result: RoomReadResult<Message> = {
        roomName, page, messages,
        ownerKnown: owner !== null,
        membersKnown: members !== null,
        membership: 'unknown',
    }
    if (owner !== null) result.owner = owner
    if (members !== null) result.members = members
    return { status: 'success', data: result }
}

export async function loadRoom(name: string, page: number): Promise<ApiResult<RoomReadResult<Message>>> {
    if (!name.trim()) {
        return { status: 'error', error: { kind: 'business', message: 'Tên phòng không được để trống' } }
    }
    if (!Number.isInteger(page) || page < 1) {
        return { status: 'error', error: { kind: 'business', message: 'Trang phải là số nguyên từ 1 trở lên' } }
    }

    try {
        const response = await socketClient.request('GET_ROOM_CHAT_MES', { name, page })
        return readRoomHistory(response, name, page)
    } catch (error) {
        if (error instanceof SocketRequestError) {
            return { status: 'error', error: { kind: error.kind, message: error.kind === 'timeout'
                        ? 'Hết thời gian chờ tải dữ liệu phòng.' : 'Kết nối bị gián đoạn khi tải dữ liệu phòng.' } }
        }
        return { status: 'error', error: { kind: 'connection', message: 'Không thể tải dữ liệu phòng qua WebSocket.' } }
    }
}

function readLeaveRoomResponse(response: unknown, requestedName: string): ApiResult<{ roomName: string }> {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Phản hồi rời phòng không hợp lệ. Chưa rõ kết quả.' } }
    }

    const reply = response as Record<string, unknown>
    if (reply.event !== 'OUT_ROOM') {
        return { status: 'unknown', error: { kind: 'parse', message: 'Phản hồi không khớp lệnh OUT_ROOM. Chưa rõ kết quả.' } }
    }

    if (reply.status === 'error') {
        const data = reply.data && typeof reply.data === 'object' && !Array.isArray(reply.data)
            ? reply.data as Record<string, unknown> : null
        const message = typeof reply.mes === 'string' ? reply.mes
            : typeof reply.data === 'string' ? reply.data
                : typeof data?.mes === 'string' ? data.mes : ''
        return { status: 'error', error: { kind: 'business', message: message.trim().slice(0, 300) || 'Máy chủ từ chối rời phòng.' } }
    }

    if (reply.status !== 'success' || !reply.data || typeof reply.data !== 'object' || Array.isArray(reply.data)) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Chưa có xác nhận rời phòng thành công hợp lệ.' } }
    }

    const data = reply.data as Record<string, unknown>
    if ('name' in data && data.name !== requestedName) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Tên phòng trong phản hồi OUT_ROOM không khớp.' } }
    }
    if (!(typeof data.mes === 'string' && data.mes.trim()) && data.name !== requestedName) {
        return { status: 'unknown', error: { kind: 'parse', message: 'Phản hồi OUT_ROOM thiếu xác nhận rời phòng.' } }
    }

    return { status: 'success', data: { roomName: requestedName } }
}

export async function leaveRoom(name: string): Promise<ApiResult<{ roomName: string }>> {
    const roomName = name.trim()
    if (!roomName) return { status: 'error', error: { kind: 'business', message: 'Tên phòng không được để trống.' } }

    try {
        const response = await socketClient.request('OUT_ROOM', { name: roomName })
        return readLeaveRoomResponse(response, roomName)
    } catch (error) {
        if (error instanceof SocketRequestError) {
            const message = error.kind === 'timeout' ? 'Hết thời gian chờ xác nhận rời phòng.' : 'Kết nối bị gián đoạn.'
            return error.wasSent
                ? { status: 'unknown', error: { kind: error.kind, message: `${message} Chưa rõ máy chủ đã xử lý OUT_ROOM hay chưa.` } }
                : { status: 'error', error: { kind: error.kind, message: `${message} Chưa gửi được OUT_ROOM.` } }
        }
        return { status: 'error', error: { kind: 'connection', message: 'Không thể gửi OUT_ROOM qua WebSocket.' } }
    }
}
