import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { checkExists } from '../../services/usersApi'
import type { AuthStatus, ConnectionStatus } from '../../types/api'
import type { OnSelectConversation } from '../../types/user'

interface Props {
    currentUser: string | null
    authStatus: AuthStatus
    connectionStatus: ConnectionStatus
    sessionGeneration: number
    onSelectConversation: OnSelectConversation
}

type Notice = { kind: 'success' | 'error' | 'unknown'; message: string } | null

export default function UserLookup({ currentUser, authStatus, connectionStatus, sessionGeneration, onSelectConversation }: Props) {
    const [username, setUsername] = useState('')
    const [checking, setChecking] = useState(false)
    const [notice, setNotice] = useState<Notice>(null)
    const requestId = useRef(0)
    const context = useRef({ currentUser, authStatus, connectionStatus, sessionGeneration })

    useEffect(() => {
        context.current = { currentUser, authStatus, connectionStatus, sessionGeneration }
    }, [currentUser, authStatus, connectionStatus, sessionGeneration])

    useEffect(() => () => { requestId.current += 1 }, [])

    async function handleCheck(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (checking) return
        const name = username.trim()
        if (!name) {
            setNotice({ kind: 'error', message: 'Vui lòng nhập username đầy đủ.' })
            return
        }
        if (!/^[A-Za-z0-9_]+$/.test(name)) {
            setNotice({ kind: 'error', message: 'Username chỉ gồm chữ cái, số và dấu gạch dưới.' })
            return
        }
        if (name.toLowerCase() === currentUser?.trim().toLowerCase()) {
            setNotice({ kind: 'error', message: 'Bạn đang chọn tài khoản của chính mình.' })
            return
        }
        if (!currentUser || authStatus !== 'authenticated' || connectionStatus !== 'connected') {
            setNotice({ kind: 'unknown', message: 'Chưa có kết nối đã xác thực. Vui lòng thử lại khi kết nối ổn định.' })
            return
        }

        const id = ++requestId.current
        setChecking(true)
        setNotice(null)
        const result = await checkExists(name)
        if (id !== requestId.current) return
        setChecking(false)
        if (context.current.sessionGeneration !== sessionGeneration || context.current.currentUser !== currentUser
            || context.current.authStatus !== 'authenticated' || context.current.connectionStatus !== 'connected') {
            setNotice({ kind: 'unknown', message: 'Phiên hoặc kết nối đã thay đổi. Vui lòng kiểm tra lại.' })
            return
        }
        if (result.status !== 'success') {
            setNotice({ kind: result.status === 'unknown' ? 'unknown' : 'error', message: result.error.message })
            return
        }
        if (!result.data) {
            setNotice({ kind: 'error', message: `Tài khoản "${name}" không tồn tại.` })
            return
        }
        setNotice({ kind: 'success', message: `Người dùng "${name}" tồn tại. Đã mở chat riêng.` })
        onSelectConversation({ kind: 'people', name })
    }

    return (
        <section className="cv43-lookup" aria-label="Tra cứu tài khoản chính xác">
            <h3>Tra cứu người dùng</h3>
            <form onSubmit={handleCheck}>
                <label htmlFor="cv43-username">Tên đăng nhập chính xác</label>
                <input
                    id="cv43-username"
                    value={username}
                    onChange={event => {
                        requestId.current += 1
                        setUsername(event.target.value)
                        setChecking(false)
                        setNotice(null)
                    }}
                    autoComplete="off"
                    placeholder="Nhập username đầy đủ..."
                />
                <button type="submit" disabled={checking || !currentUser || authStatus !== 'authenticated' || connectionStatus !== 'connected'}>
                    {checking ? 'Đang kiểm tra...' : 'Kiểm tra người dùng'}
                </button>
            </form>
            <p className="cv39-hint">Chỉ kiểm tra khi bấm nút, không dò tài khoản theo từng ký tự.</p>
            {notice && <p className={`cv43-feedback cv43-${notice.kind}`} role={notice.kind === 'success' ? 'status' : 'alert'}>{notice.message}</p>}
        </section>
    )
}
