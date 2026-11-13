import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { ApiResult, ConversationRef } from '../../types/api'
import type { Room } from '../../types/room'
import { mockJoinRoom } from './roomMockServices'
import type { RoomMockMode } from './roomMockServices'
import { getRoomRequest, sendRoomRequest, subscribeRoomRequests } from './roomRequestState'
import type { RoomRequestStatus } from './roomRequestState'
import { useAppSelector } from '../../store/hooks'
import { store } from '../../store'

type RequestUpdate = {
    name: string
    sessionGeneration: number
    status: RoomRequestStatus
}

interface Props {
    onClose: (request?: { name: string; sessionGeneration: number; status: 'pending' | 'unknown' }) => void
    onJoined?: (room: Room) => void
    onSelectConversation?: (conversation: ConversationRef) => void
    onRequestChange?: (request: RequestUpdate) => void
    joinRoom?: (name: string) => Promise<ApiResult<Room>>
    initialName?: string
    mockMode?: RoomMockMode
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

export default function JoinRoom({
                                     onClose, onJoined, onSelectConversation, onRequestChange, joinRoom, initialName = '', mockMode = 'normal',
                                 }: Props) {
    const sessionGeneration = useAppSelector(state => state.auth.sessionGeneration)
    const [name, setName] = useState(initialName)
    const [inputError, setInputError] = useState('')
    const isOpen = useRef(true)

    useEffect(() => {
        isOpen.current = true
        return () => { isOpen.current = false }
    }, [])

    const request = useSyncExternalStore(
        subscribeRoomRequests,
        () => getRoomRequest('join', name.trim(), sessionGeneration),
        () => null,
    )
    const status = request?.status ?? 'idle'
    const locked = status === 'pending' || status === 'unknown' || status === 'success'

    function close() {
        isOpen.current = false
        const latest = getRoomRequest('join', name.trim(), sessionGeneration)
        if (latest?.status === 'pending' || latest?.status === 'unknown') {
            onClose({ name: latest.name, sessionGeneration: latest.sessionGeneration, status: latest.status })
        } else {
            onClose()
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const roomName = name.trim()
        if (!roomName) {
            setInputError('Vui lòng nhập tên phòng.')
            return
        }

        setInputError('')
        const result = await sendRoomRequest(
            'join',
            roomName,
            sessionGeneration,
            () => store.getState().auth.sessionGeneration,
            () => joinRoom ? joinRoom(roomName) : mockJoinRoom(roomName, mockMode),
            update => onRequestChange?.({ name: update.name, sessionGeneration: update.sessionGeneration, status: update.status }),
        )

        if (result?.status === 'success' && isOpen.current) {
            onJoined?.(result.data)
            onSelectConversation?.({ kind: 'room', name: result.data.name })
        }
    }

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
                                setInputError('')
                            }}
                            placeholder="Nhập tên phòng..."
                            disabled={locked}
                            autoComplete="off"
                            style={{ boxSizing: 'border-box', width: '100%', padding: '12px 14px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 16 }}
                        />
                    </label>
                    <p style={{ margin: 0, padding: 12, borderRadius: 9, background: '#eff6ff', color: '#1d3557', fontSize: 15 }}>
                        Chỉ khi bấm Tham gia phòng mới gửi yêu cầu. Gõ tên không tự tham gia hoặc tạo phòng.
                    </p>
                    {status === 'pending' && <p role="status">Đang chờ phản hồi. Bạn không thể gửi lại cùng tên phòng lúc này.</p>}
                    {(inputError || (request?.message && status !== 'pending')) && (
                        <p role={status === 'success' ? 'status' : 'alert'} style={{ margin: 0, color: status === 'success' ? '#166534' : '#b42318' }}>
                            {inputError || request?.message}
                        </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                        <button type="button" onClick={close} style={buttonStyle}>Hủy</button>
                        <button type="submit" disabled={locked} style={{ ...buttonStyle, background: '#2563eb', borderColor: '#2563eb', color: '#fff', opacity: locked ? 0.7 : 1 }}>
                            {status === 'pending' ? 'Đang tham gia...' : 'Tham gia phòng'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}
