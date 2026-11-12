const sessionKey = 'appchat.session'

export interface LoginSession {
    username: string
    reLoginCode: string
}

export function readStoredSession(): LoginSession | null {
    try {
        const rawSession = sessionStorage.getItem(sessionKey)
        if (!rawSession) return null

        const session: unknown = JSON.parse(rawSession)
        if (session && typeof session === 'object' && 'username' in session && 'reLoginCode' in session) {
            const { username, reLoginCode } = session
            if (typeof username === 'string' && username.trim() && typeof reLoginCode === 'string' && reLoginCode.trim()) {
                return { username, reLoginCode }
            }
        }
    } catch {
        // Có thể gặp dữ liệu hỏng hoặc trình duyệt chặn storage
    }

    clearStoredSession()
    return null
}

export function saveSession({ username, reLoginCode }: LoginSession) {
    try {
        sessionStorage.setItem(sessionKey, JSON.stringify({ username, reLoginCode }))
    } catch {
        // Phiên hiện tại vẫn dùng được khi trình duyệt chặn storage
    }
}

export function clearStoredSession() {
    try {
        sessionStorage.removeItem(sessionKey)
    } catch {
        // Trình duyệt có thể chặn storage
    }
}
