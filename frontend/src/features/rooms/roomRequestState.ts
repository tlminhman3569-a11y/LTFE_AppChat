import type { ApiResult } from '../../types/api'
import type { Room } from '../../types/room'

export type RoomAction = 'create' | 'join'
export type RoomRequestStatus = 'pending' | 'error' | 'unknown' | 'success'

export type RoomRequest = {
    name: string
    status: RoomRequestStatus
    message: string
}

const requests = new Map<string, RoomRequest>()
const listeners = new Set<() => void>()

function requestKey(action: RoomAction, name: string) {
    return JSON.stringify([action, name.trim()])
}

export function getRoomRequest(action: RoomAction, name: string): RoomRequest | null {
    return requests.get(requestKey(action, name)) ?? null
}

export function subscribeRoomRequests(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

function saveRequest(action: RoomAction, request: RoomRequest) {
    requests.set(requestKey(action, request.name), request)
    listeners.forEach(listener => listener())
}

export function clearRoomRequest(action: RoomAction, name: string) {
    requests.delete(requestKey(action, name))
    listeners.forEach(listener => listener())
}

export async function sendRoomRequest(
    action: RoomAction,
    name: string,
    send: () => Promise<ApiResult<Room>>,
    onChange?: (request: RoomRequest) => void,
): Promise<ApiResult<Room> | null> {
    const roomName = name.trim()
    if (!roomName) return null

    const previous = getRoomRequest(action, roomName)
    if (previous && previous.status !== 'error') return null

    const pending: RoomRequest = {
        name: roomName,
        status: 'pending',
        message: action === 'create' ? 'Đang gửi yêu cầu tạo phòng.' : 'Đang gửi yêu cầu tham gia phòng.',
    }
    saveRequest(action, pending)
    onChange?.(pending)

    let result: ApiResult<Room>
    try {
        result = await send()
    } catch {
        result = {
            status: 'unknown',
            error: {
                kind: 'connection',
                message: action === 'create'
                    ? 'Mất kết nối. Chưa rõ phòng đã được tạo hay chưa.'
                    : 'Mất kết nối. Chưa rõ đã tham gia phòng hay chưa.',
            },
        }
    }

    let finished: RoomRequest
    if (result.status === 'success') {
        finished = { name: roomName, status: 'success', message: action === 'create' ? `Đã tạo phòng ${roomName}.` : `Đã tham gia phòng ${roomName}.` }
    } else if (result.status === 'unknown' || ['connection', 'timeout', 'parse'].includes(result.error.kind)) {
        finished = { name: roomName, status: 'unknown', message: `${result.error.message} Hãy kiểm tra trạng thái phòng trước khi gửi lại.` }
    } else {
        finished = { name: roomName, status: 'error', message: result.error.message }
    }

    saveRequest(action, finished)
    onChange?.(finished)
    return result
}
