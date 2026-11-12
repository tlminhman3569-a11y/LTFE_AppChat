import type { ApiResult } from '../types/api'
import { socketClient, SocketRequestError } from './socketClient'

const socketUrl = 'wss://chat.longapp.io.vn/chat/chat'

interface LoginSession {
    username: string
    reLoginCode: string
}

export async function login(username: string, password: string): Promise<ApiResult<LoginSession>> {
    try {
        await socketClient.connect(socketUrl)
        const response = await socketClient.request('LOGIN', { user: username, pass: password })

        if (response.status === 'error') {
            socketClient.disconnect()
            return { status: 'error', error: { kind: 'business', message: 'Đăng nhập không thành công' } }
        }

        const data = response.data
        if (response.status === 'success' && data && typeof data === 'object' && 'RE_LOGIN_CODE' in data) {
            const reLoginCode = data.RE_LOGIN_CODE
            if (typeof reLoginCode === 'string' && reLoginCode.trim()) {
                return { status: 'success', data: { username, reLoginCode } }
            }
        }

        // Máy chủ có thể đã xác thực socket dù mã phiên không dùng được
        socketClient.disconnect()
        return { status: 'error', error: { kind: 'parse', message: 'Phản hồi đăng nhập thiếu mã phiên hợp lệ' } }
    } catch (error) {
        if (error instanceof SocketRequestError && error.wasSent) {
            return { status: 'unknown', error: { kind: error.kind, message: 'Chưa xác định được kết quả đăng nhập' } }
        }

        return { status: 'error', error: { kind: 'connection', message: 'Không thể kết nối để đăng nhập' } }
    }
}

function commandResult(status: unknown, errorMessage: string): ApiResult<null> {
    if (status === 'success') return { status: 'success', data: null }
    if (status === 'error') {
        return { status: 'error', error: { kind: 'business', message: errorMessage } }
    }
    return { status: 'unknown', error: { kind: 'parse', message: 'Phản hồi từ máy chủ không hợp lệ' } }
}

function commandFailure(error: unknown, action: string): ApiResult<never> {
    if (error instanceof SocketRequestError && error.wasSent) {
        return { status: 'unknown', error: { kind: error.kind, message: `Chưa xác định được kết quả ${action}` } }
    }
    return { status: 'error', error: { kind: 'connection', message: `Không thể kết nối để ${action}` } }
}

export async function register(username: string, password: string): Promise<ApiResult<null>> {
    try {
        await socketClient.connect(socketUrl)
        const response = await socketClient.request('REGISTER', { user: username, pass: password })
        return commandResult(response.status, 'Đăng ký không thành công')
    } catch (error) {
        return commandFailure(error, 'đăng ký')
    }
}

export async function logout(): Promise<ApiResult<null>> {
    try {
        if (socketClient.getStatus() !== 'connected') {
            return { status: 'error', error: { kind: 'connection', message: 'Mất kết nối nên chưa báo được máy chủ' } }
        }
        const response = await socketClient.request('LOGOUT')
        return commandResult(response.status, 'Máy chủ từ chối đăng xuất')
    } catch (error) {
        return commandFailure(error, 'đăng xuất')
    } finally {
        socketClient.disconnect()
    }
}
