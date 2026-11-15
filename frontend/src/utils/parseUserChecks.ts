import type { ApiResult } from '../types/api'
import type { UserPresence } from '../types/user'

type Response = Record<string, unknown>

function isRecord(value: unknown): value is Response {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readCheckStatus(value: unknown, event: string): ApiResult<boolean> {
    if (!isRecord(value) || value.event !== event) {
        return { status: 'error', error: { kind: 'parse', message: `Phản hồi ${event} không hợp lệ.` } }
    }
    if (value.status === 'error') {
        return { status: 'error', error: { kind: 'business', message: 'Máy chủ từ chối yêu cầu kiểm tra.' } }
    }
    if (value.status !== undefined && value.status !== 'success') {
        return { status: 'error', error: { kind: 'parse', message: `Chưa có kết quả ${event} hợp lệ.` } }
    }
    if (!isRecord(value.data) || typeof value.data.status !== 'boolean') {
        return { status: 'error', error: { kind: 'parse', message: `Máy chủ chưa trả data.status hợp lệ cho ${event}.` } }
    }
    return { status: 'success', data: value.data.status }
}

export function parseUserExists(value: unknown): ApiResult<boolean> {
    return readCheckStatus(value, 'CHECK_USER_EXIST')
}

export function parseUserOnline(value: unknown, checkedAt: string): ApiResult<UserPresence> {
    const result = readCheckStatus(value, 'CHECK_USER_ONLINE')
    if (result.status !== 'success') return result
    return { status: 'success', data: { status: result.data ? 'online' : 'offline', checkedAt } }
}
