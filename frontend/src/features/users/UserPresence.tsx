import { useEffect, useState } from 'react'
import { checkOnline } from '../../services/usersApi'
import type { AuthStatus, ConnectionStatus } from '../../types/api'
import type { UserPresence as Presence } from '../../types/user'

interface Props {
    username: string
    authStatus: AuthStatus
    connectionStatus: ConnectionStatus
    sessionGeneration: number
}

export default function UserPresence({ username, authStatus, connectionStatus, sessionGeneration }: Props) {
    const [retry, setRetry] = useState(0)
    const [result, setResult] = useState<{ username: string; sessionGeneration: number; presence: Presence; loading: boolean }>({
        username, sessionGeneration, presence: { status: 'unknown' }, loading: true,
    })
    const ready = authStatus === 'authenticated' && connectionStatus === 'connected'
    const active = result.username === username && result.sessionGeneration === sessionGeneration
    const presence = active ? result.presence : { status: 'unknown' as const }
    const loading = active && result.loading && ready

    useEffect(() => {
        let current = true
        const checkedAt = new Date().toISOString()
        if (!ready) return () => { current = false }

        async function loadPresence() {
            const response = await checkOnline(username)
            if (!current) return
            setResult({
                username, sessionGeneration, loading: false,
                presence: response.status === 'success' ? response.data : { status: 'unknown', checkedAt },
            })
        }

        void loadPresence()
        return () => { current = false }
    }, [username, sessionGeneration, ready, retry])

    const text = !ready ? 'Không xác định (chưa kết nối)' : loading ? 'Đang kiểm tra...' :
        presence.status === 'online' ? 'Online tại lần kiểm tra' :
            presence.status === 'offline' ? 'Offline tại lần kiểm tra' : 'Không xác định'

    return (
        <section className="cv43-presence" aria-label="Trạng thái người đang trò chuyện">
            <div className="cv43-presence-heading">
                <h3>Trạng thái: {username}</h3>
                <button type="button" disabled={!ready || loading} onClick={() => {
                    setResult({ username, sessionGeneration, presence: { status: 'unknown' }, loading: true })
                    setRetry(value => value + 1)
                }}>
                    Kiểm tra online
                </button>
            </div>
            <p role="status">{text}</p>
            {ready && presence.checkedAt && <p className="cv39-hint">Kiểm tra lúc {new Date(presence.checkedAt).toLocaleString('vi-VN')}</p>}
            <p className="cv39-hint">Trạng thái tại thời điểm kiểm tra, không phải theo thời gian thực.</p>
        </section>
    )
}
