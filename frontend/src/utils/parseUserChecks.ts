import type { ApiResult } from '../types/api'
import type { UserPresence } from '../types/user'

type Response = Record<string, unknown>

function isRecord(value: unknown): value is Response {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value
    if (value === 1 || value === 'true') return true
    if (value === 0 || value === 'false') return false
    return null
}

function readField(value: unknown, fields: string[]): unknown {
    if (!isRecord(value)) return value
    for (const field of fields) {
        if (Object.hasOwn(value, field)) return value[field]
    }
    return undefined
}

function validateResponse(value: unknown, event: string): ApiResult<Response> {
    if (!isRecord(value) || value.event !== event) {
        return { status: 'error', error: { kind: 'parse', message: `Phản hồi ${event} không hợp lệ.` } }
    }
    if (value.status === 'error') {
        return { status: 'error', error: { kind: 'business', message: 'Máy chủ từ chối yêu cầu kiểm tra.' } }
    }
    if (value.status !== 'success') {
        return { status: 'error', error: { kind: 'parse', message: `Chưa có kết quả ${event} hợp lệ.` } }
    }
    return { status: 'success', data: value }
}

export function parseUserExists(value: unknown): ApiResult<boolean> {
    if (isRecord(value) && value.event === 'CHECK_USER_EXIST'
        && value.status === undefined && isRecord(value.data)
        && typeof value.data.status === 'boolean') {
        return { status: 'success', data: value.data.status }
    }

    const validated = validateResponse(value, 'CHECK_USER_EXIST')
    if (validated.status !== 'success') return validated

    const answer = readField(validated.data.data, ['status', 'exists', 'exist', 'isExist', 'isExisting'])
    const exists = readBoolean(answer)
    if (exists === null) {
        return { status: 'error', error: { kind: 'parse', message: 'Máy chủ chưa trả kết quả tồn tại rõ ràng.' } }
    }
    return { status: 'success', data: exists }
}

export function parseUserOnline(value: unknown, checkedAt: string): ApiResult<UserPresence> {
    const validated = validateResponse(value, 'CHECK_USER_ONLINE')
    if (validated.status !== 'success') return validated

    const answer = readField(validated.data.data, ['online', 'isOnline', 'status'])
    const online = answer === 'online' ? true : answer === 'offline' ? false : readBoolean(answer)
    if (online === null) {
        return { status: 'error', error: { kind: 'parse', message: 'Máy chủ chưa trả trạng thái online rõ ràng.' } }
    }
    return { status: 'success', data: { status: online ? 'online' : 'offline', checkedAt } }
}
