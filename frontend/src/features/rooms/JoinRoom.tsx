import { useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { ApiResult, ConversationRef } from '../../types/api'
import type { Room } from '../../types/room'
import { rooms } from '../../fixtures/rooms'

type MockMode = 'normal' | 'error' | 'unknown'
type FormStatus = 'idle' | 'loading' | 'error' | 'unknown' | 'success'

type RequestUpdate = {
    name: string
    status: 'pending' | 'error' | 'unknown' | 'success'
}

interface Props {
    onClose: (request?: { name: string; status: 'pending' | 'unknown' }) => void
    onJoined?: (room: Room) => void
    onSelectConversation?: (conversation: ConversationRef) => void
    onRequestChange?: (request: RequestUpdate) => void
    joinRoom?: (name: string) => Promise<ApiResult<Room>>
    initialName?: string
    mockMode?: MockMode
}

const boxStyle: CSSProperties = {
    width: 'min(100%, 560px)',
    boxSizing: 'border-box',
    padding: 'clamp(20px, 5vw, 32px)',
    border: '1px solid #d8dfe8',
    borderRadius: 16,
    background: '#fff',
    color: '#182333',
    boxShadow: '0 16px 48px #0f172a25',
    textAlign: 'left',
}

const buttonStyle: CSSProperties = {
    padding: '12px 18px',
    borderRadius: 9,
    border: '1px solid #d8dfe8',
    background: '#fff',
    color: '#182333',
    cursor: 'pointer',
    fontSize: 16,
}

export async function mockJoinRoom(name: string, mode: MockMode = 'normal'): Promise<ApiResult<Room>> {
    await new Promise(resolve => setTimeout(resolve, 300))

    if (!name.trim()) {
        return { status: 'error', error: { kind: 'business', message: 'Vui lòng nhập tên phòng.' } }
    }
    if (mode === 'unknown') {
        return { status: 'unknown', error: { kind: 'timeout', message: 'Chưa xác định được yêu cầu tham gia có thành công hay chưa.' } }
    }
    if (mode === 'error') {
        return { status: 'error', error: { kind: 'business', message: 'Không tham gia được phòng (dữ liệu mô phỏng).' } }
    }

    const room = rooms.find(item => item.name === name)
    if (!room) {
        return {
            status: 'error',
            error: { kind: 'business', message: 'Không có phòng này trong fixture. Điều này không chứng minh phòng không tồn tại trên hệ thống.' },
        }
    }

    return { status: 'success', data: { ...room, membership: 'member' } }
}

export default function JoinRoom({
                                     onClose, onJoined, onSelectConversation, onRequestChange, joinRoom, initialName = '', mockMode = 'normal',
                                 }: Props) {
    const [name, setName] = useState(initialName)
    const [status, setStatus] = useState<FormStatus>('idle')
    const [message, setMessage] = useState('')
    const submittedName = useRef('')
    const sending = useRef(false)

    function close() {
        if (status === 'loading') {
            onClose({ name: submittedName.current, status: 'pending' })
        } else if (status === 'unknown') {
            onClose({ name: submittedName.current, status: 'unknown' })
        } else {
            onClose()
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (sending.current || status === 'success' || status === 'unknown') return

        const roomName = name.trim()
        if (!roomName) {
            setStatus('error')
            setMessage('Vui lòng nhập tên phòng.')
            return
        }

        sending.current = true
        submittedName.current = roomName
        setStatus('loading')
        setMessage('')
        onRequestChange?.({ name: roomName, status: 'pending' })

        let result: ApiResult<Room>
        try {
            result = await (joinRoom ? joinRoom(roomName) : mockJoinRoom(roomName, mockMode))
        } catch {
            result = {
                status: 'unknown',
                error: { kind: 'connection', message: 'Mất kết nối khi gửi. Chưa rõ đã tham gia phòng hay chưa.' },
            }
        }
        sending.current = false

        if (result.status === 'success') {
            setStatus('success')
            setMessage(`Đã tham gia phòng ${result.data.name}.`)
            onRequestChange?.({ name: roomName, status: 'success' })
            onJoined?.(result.data)
            onSelectConversation?.({ kind: 'room', name: result.data.name })
            return
        }

        if (result.status === 'unknown' || ['timeout', 'connection', 'parse'].includes(result.error.kind)) {
            setStatus('unknown')
            setMessage(`${result.error.message} Hãy kiểm tra tư cách thành viên trước khi gửi lại.`)
            onRequestChange?.({ name: roomName, status: 'unknown' })
            return
        }

        setStatus('error')
        setMessage(result.error.message)
        onRequestChange?.({ name: roomName, status: 'error' })
    }

    const locked = status === 'loading' || status === 'success' || status === 'unknown'

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto', background: '#0f172a77' }}>
            <section role="dialog" aria-modal="true" aria-labelledby="cv40-join-title" style={boxStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <h2 id="cv40-join-title" style={{ margin: 0, fontSize: 26 }}>Tham gia phòng</h2>
                    <button type="button" onClick={close} style={{ ...buttonStyle, border: 0, color: '#2563eb' }}>Đóng</button>
                </div>
                <form onSubmit={submit} style={{ display: 'grid', gap: 18, marginTop: 24 }}>
                    <label style={{ display: 'grid', gap: 9, fontWeight: 600 }}>
                        Tên phòng chính xác
                        <input
                            value={name}
                            onChange={event => {
                                setName(event.target.value)
                                if (status === 'error') {
                                    setStatus('idle')
                                    setMessage('')
                                }
                            }}
                            placeholder="Nhập tên phòng..."
                            disabled={locked}
                            autoComplete="off"
                            style={{ boxSizing: 'border-box', width: '100%', padding: '12px 14px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 16 }}
                        />
                    </label>
                    <p style={{ margin: 0, padding: 12, borderRadius: 9, background: '#eff6ff', color: '#1d3557', fontSize: 15 }}>
                        Chỉ khi bấm Tham gia phòng mới gửi yêu cầu. Thao tác này có thể thay đổi tư cách thành viên. Gõ tìm không tự tham gia và không tự tạo phòng.
                    </p>
                    {status === 'loading' && <p role="status">Đang gửi yêu cầu tham gia. Đóng form không hủy yêu cầu đã gửi.</p>}
                    {message && (
                        <p role={status === 'success' ? 'status' : 'alert'} style={{ margin: 0, color: status === 'success' ? '#166534' : '#b42318' }}>
                            {message}
                        </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                        <button type="button" onClick={close} style={buttonStyle}>Hủy</button>
                        <button type="submit" disabled={locked} style={{ ...buttonStyle, background: '#2563eb', borderColor: '#2563eb', color: '#fff', opacity: locked ? 0.7 : 1 }}>
                            {status === 'loading' ? 'Đang tham gia...' : 'Tham gia phòng'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}
