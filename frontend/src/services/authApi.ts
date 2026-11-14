import type { ApiResult } from '../types/api'
import { socketClient, SocketRequestError } from './socketClient'
import { clearStoredSession, readStoredSession, saveSession } from './sessionStorage.ts'
import type { LoginSession } from './sessionStorage.ts'

const socketUrl = 'wss://chat.longapp.io.vn/chat/chat'

function readReLoginCode(data: unknown) {
    if (!data || typeof data !== 'object' || !('RE_LOGIN_CODE' in data)) return null
    const code = data.RE_LOGIN_CODE
    return typeof code === 'string' && code.trim() ? code : null
}

export async function login(username: string, password: string): Promise<ApiResult<LoginSession>> {
    try {
        await socketClient.connect(socketUrl)
        const response = await socketClient.request('LOGIN', { user: username, pass: password })

        if (response.status === 'error') {
            socketClient.disconnect()
            return { status: 'error', error: { kind: 'business', message: 'Đăng nhập không thành công' } }
        }

        const reLoginCode = readReLoginCode(response.data)
        if (response.status === 'success' && reLoginCode) {
            return { status: 'success', data: { username, reLoginCode } }
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

export async function reLogin(session: LoginSession, isCurrent: () => boolean = () => true): Promise<ApiResult<LoginSession>> {
    const { username, reLoginCode } = session
    try {
        await socketClient.connect(socketUrl)
        if (!isCurrent()) return commandFailure(null, 'khôi phục phiên')

        const response = await socketClient.request('RE_LOGIN', { user: username, code: reLoginCode })
        if (!isCurrent()) return commandFailure(null, 'khôi phục phiên')
        const newCode = readReLoginCode(response.data)
        if (response.status === 'success' && newCode) {
            const renewedSession = { username, reLoginCode: newCode }
            const storedSession = readStoredSession()
            if (storedSession?.username === username && storedSession.reLoginCode === reLoginCode) {
                saveSession(renewedSession)
            }
            return { status: 'success', data: renewedSession }
        }

        socketClient.disconnect()
        if (response.status === 'error') {
            return { status: 'error', error: { kind: 'session', message: 'Phiên đã hết hạn, vui lòng đăng nhập lại' } }
        }
        return { status: 'error', error: { kind: 'parse', message: 'Phản hồi khôi phục phiên thiếu mã hợp lệ' } }
    } catch (error) {
        return commandFailure(error, 'khôi phục phiên')
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
        if (response.status === 'error' && response.mes === 'User already exists!') {
            return {
                status: 'error',
                error: { kind: 'business', code: 'username_taken', message: 'Tên đăng nhập đã được sử dụng' },
            }
        }
        return commandResult(response.status, 'Đăng ký không thành công')
    } catch (error) {
        return commandFailure(error, 'đăng ký')
    }
}

let pendingLogout: Promise<ApiResult<null>> | undefined

export function logout(): Promise<ApiResult<null>> {
    if (!pendingLogout) {
        clearStoredSession()
        pendingLogout = finishLogout().finally(() => { pendingLogout = undefined })
    }
    return pendingLogout
}

async function finishLogout(): Promise<ApiResult<null>> {
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
        socketClient.clearSessionListeners()
    }
}
