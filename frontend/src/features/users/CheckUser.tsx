import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiResult } from '../../types/api'
import { checkExists } from '../../services/usersApi'
import { store } from '../../store'
import { useAppSelector } from '../../store/hooks'
import type { OnSelectConversation } from '../../types/user'

type Props = {
    username: string
    onSelectConversation: OnSelectConversation
}

type CheckStatus = 'idle' | 'checking' | 'self' | 'missing' | 'error' | 'unknown'

export default function CheckUser({ username, onSelectConversation }: Props) {
    const { currentUser, authStatus, connectionStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const [status, setStatus] = useState<CheckStatus>('idle')
    const [message, setMessage] = useState('')
    const pending = useRef(false)
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])

    async function handleCheck(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const user = username.trim()
        if (pending.current) return
        if (!user) {
            setStatus('error')
            setMessage('Vui lòng nhập username đầy đủ.')
            return
        }
        if (user === currentUser) {
            setStatus('self')
            setMessage('Đây là tài khoản của bạn. Không thể tự mở chat với chính mình.')
            return
        }
        if (authStatus !== 'authenticated' || connectionStatus !== 'connected') {
            setStatus('error')
            setMessage('Chưa kết nối máy chủ. Vui lòng thử lại sau.')
            return
        }

        pending.current = true
        setStatus('checking')
        setMessage('Đang kiểm tra username trên máy chủ...')
        let result: ApiResult<boolean>
        try {
            result = await checkExists(user)
        } catch {
            result = { status: 'unknown' as const, error: { kind: 'connection' as const, message: 'Chưa thể xác định tài khoản.' } }
        } finally {
            pending.current = false
        }

        if (!mounted.current || store.getState().auth.sessionGeneration !== sessionGeneration) return
        if (result.status === 'success') {
            if (result.data === true) {
                setStatus('idle')
                setMessage('Đã xác nhận tài khoản. Đang mở chat riêng.')
                onSelectConversation({ kind: 'people', name: user })
            } else {
                setStatus('missing')
                setMessage('Không tìm thấy tài khoản với username này.')
            }
            return
        }

        setStatus(result.status === 'unknown' ? 'unknown' : 'error')
        setMessage(result.error.message)
    }

    return (
        <form onSubmit={handleCheck} className="cv43-user-check" aria-label="Kiểm tra username chính xác">
            <p className="cv39-hint">Nhập username đầy đủ rồi bấm Kiểm tra. Không có gợi ý gần đây không có nghĩa tài khoản không tồn tại.</p>
            <button type="submit" disabled={status === 'checking'}>
                {status === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra người dùng'}
            </button>
            {message && <p role={status === 'idle' || status === 'checking' ? 'status' : 'alert'} className="cv39-notice">{message}</p>}
        </form>
    )
}
