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
