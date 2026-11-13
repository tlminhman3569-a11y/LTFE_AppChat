import type { ApiResult } from '../../types/api'
import type { Room } from '../../types/room'

export type RoomAction = 'create' | 'join'
export type RoomRequestStatus = 'pending' | 'error' | 'unknown' | 'success'

export type RoomRequest = {
    name: string
    sessionGeneration: number
    status: RoomRequestStatus
    message: string
}

const requests = new Map<string, RoomRequest>()
const listeners = new Set<() => void>()

function requestKey(sessionGeneration: number, action: RoomAction, name: string) {
    return JSON.stringify([sessionGeneration, action, name.trim()])
}

function notifyListeners() {
    listeners.forEach(listener => listener())
}

export function getRoomRequest(action: RoomAction, name: string, sessionGeneration: number): RoomRequest | null {
    return requests.get(requestKey(sessionGeneration, action, name)) ?? null
}

export function subscribeRoomRequests(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function clearRoomRequest(action: RoomAction, name: string, sessionGeneration: number) {
    const removed = requests.delete(requestKey(sessionGeneration, action, name))
    if (removed) notifyListeners()
}

export async function sendRoomRequest(
    action: RoomAction,
    name: string,
    sessionGeneration: number,
    getCurrentSessionGeneration: () => number,
    send: () => Promise<ApiResult<Room>>,
    onChange?: (request: RoomRequest) => void,
): Promise<ApiResult<Room> | null> {
    const roomName = name.trim()
    if (!roomName || getCurrentSessionGeneration() !== sessionGeneration) return null

    const key = requestKey(sessionGeneration, action, roomName)
    const previous = requests.get(key)
    if (previous && previous.status !== 'error') return null

    const pending: RoomRequest = {
        name: roomName,
        sessionGeneration,
        status: 'pending',
        message: action === 'create' ? 'Đang gửi yêu cầu tạo phòng.' : 'Đang gửi yêu cầu tham gia phòng.',
    }
    requests.set(key, pending)
    notifyListeners()
    onChange?.(pending)

    if (getCurrentSessionGeneration() !== sessionGeneration) {
        if (requests.get(key) === pending) clearRoomRequest(action, roomName, sessionGeneration)
        return null
    }

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

    if (getCurrentSessionGeneration() !== sessionGeneration || requests.get(key) !== pending) {
        if (requests.get(key) === pending) clearRoomRequest(action, roomName, sessionGeneration)
        return null
    }

    let finished: RoomRequest
    if (result.status === 'success') {
        finished = {
            name: roomName,
            sessionGeneration,
            status: 'success',
            message: action === 'create' ? `Đã tạo phòng ${roomName}.` : `Đã tham gia phòng ${roomName}.`,
        }
    } else if (result.status === 'unknown' || ['connection', 'timeout', 'parse'].includes(result.error.kind)) {
        finished = {
            name: roomName,
            sessionGeneration,
            status: 'unknown',
            message: `${result.error.message} Hãy kiểm tra trạng thái phòng trước khi gửi lại.`,
        }
    } else {
        finished = {
            name: roomName,
            sessionGeneration,
            status: 'error',
            message: result.error.message,
        }
    }

    requests.set(key, finished)
    notifyListeners()
    onChange?.(finished)
    return result
}
