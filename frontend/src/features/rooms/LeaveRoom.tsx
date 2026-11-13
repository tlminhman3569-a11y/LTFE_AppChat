import { useSyncExternalStore } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { ApiResult } from '../../types/api'
import type { Room, RoomConversationRef } from '../../types/room'
import { useAppSelector } from '../../store/hooks'
import { store } from '../../store'

type LeaveStatus = 'pending' | 'unknown' | 'error' | 'success'

type LeaveRequest = {
    status: LeaveStatus
    message: string
}

type Props = {
    room: Room
    currentUser: string | null
    hasDraft: boolean
    draftPreview?: string
    onClose: () => void
    onLeaveConfirmed: (conversation: RoomConversationRef) => void
    onStatusChange?: (conversation: RoomConversationRef, status: LeaveStatus) => void
    leaveRoom?: (name: string) => Promise<ApiResult<{ roomName: string }>>
}

const requests = new Map<string, LeaveRequest>()
const listeners = new Set<() => void>()

function requestKey(sessionGeneration: number, name: string) {
    return JSON.stringify([sessionGeneration, name])
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

function updateRequest(key: string, request: LeaveRequest) {
    requests.set(key, request)
    listeners.forEach(listener => listener())
}

async function mockLeaveRoom(room: Room): Promise<ApiResult<{ roomName: string }>> {
    if (room.membership === 'left') {
        return { status: 'error', error: { kind: 'business', message: 'Bạn đã rời phòng này.' } }
    }
    if (room.membership !== 'member') {
        return { status: 'unknown', error: { kind: 'business', message: 'Fixture chưa xác nhận quyền rời phòng.' } }
    }
    return { status: 'success', data: { roomName: room.name } }
}

const buttonStyle: CSSProperties = {
    padding: '12px 18px',
    border: '1px solid #d8dfe8',
    borderRadius: 9,
    background: '#fff',
    color: '#182333',
    cursor: 'pointer',
    fontSize: 16,
}

export default function LeaveRoom({
                                      room, currentUser, hasDraft, draftPreview, onClose,
                                      onLeaveConfirmed, onStatusChange, leaveRoom,
                                  }: Props) {
    const sessionGeneration = useAppSelector(state => state.auth.sessionGeneration)
    const conversation: RoomConversationRef = { kind: 'room', name: room.name }
    const key = requestKey(sessionGeneration, room.name)
    const request = useSyncExternalStore(subscribe, () => requests.get(key) ?? null, () => null)
    const status = request?.status
    const isOwner = room.ownerKnown
        ? !!currentUser && room.owner === currentUser
        : room.membership === 'owner'
    const hasLeft = room.membership === 'left'
    const locked = status === 'pending' || status === 'unknown' || status === 'success'
    const cannotLeave = isOwner || hasLeft || !currentUser

    async function confirm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (cannotLeave || locked) return
        if (store.getState().auth.sessionGeneration !== sessionGeneration) return
        const previous = requests.get(key)
        if (previous && previous.status !== 'error') return

        const pending: LeaveRequest = { status: 'pending', message: 'Đang chờ xác nhận rời phòng.' }
        updateRequest(key, pending)
        onStatusChange?.(conversation, 'pending')

        let result: ApiResult<{ roomName: string }>
        try {
            result = leaveRoom ? await leaveRoom(room.name) : await mockLeaveRoom(room)
        } catch {
            result = { status: 'unknown', error: { kind: 'connection', message: 'Mất kết nối, chưa rõ đã rời phòng hay chưa.' } }
        }

        if (store.getState().auth.sessionGeneration !== sessionGeneration || requests.get(key) !== pending) return

        if (result.status === 'success' && result.data.roomName === room.name) {
            updateRequest(key, { status: 'success', message: 'Đã rời phòng (theo kết quả xác nhận).' })
            onStatusChange?.(conversation, 'success')
            onLeaveConfirmed(conversation)
            return
        }

        if (result.status === 'success') {
            updateRequest(key, { status: 'unknown', message: 'Phản hồi không khớp tên phòng. Cần kiểm tra lại quyền phòng.' })
            onStatusChange?.(conversation, 'unknown')
            return
        }

        if (result.status === 'unknown' || result.error.kind !== 'business') {
            updateRequest(key, { status: 'unknown', message: `${result.error.message} Chưa rõ kết quả. Hãy kiểm tra lại trước khi thao tác tiếp.` })
            onStatusChange?.(conversation, 'unknown')
            return
        }

        updateRequest(key, { status: 'error', message: result.error.message })
        onStatusChange?.(conversation, 'error')
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'grid',
            placeItems: 'center', padding: 16, overflowY: 'auto', background: '#0f172a77',
        }}>
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="cv41-leave-title"
                style={{
                    width: 'min(100%, 560px)', boxSizing: 'border-box', padding: 'clamp(20px, 5vw, 32px)',
                    border: '1px solid #d8dfe8', borderRadius: 16, background: '#fff', color: '#182333',
                    boxShadow: '0 16px 48px #0f172a25',
                }}
            >
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <h2 id="cv41-leave-title" style={{ margin: 0, fontSize: 24 }}>Rời phòng {room.name}?</h2>
                    <button type="button" onClick={onClose} style={{ ...buttonStyle, border: 0, color: '#2563eb' }}>
                        Đóng
                    </button>
                </header>

                {hasDraft && (
                    <div role="alert" style={{ padding: 14, marginTop: 20, background: '#eff6ff', borderRadius: 9 }}>
                        <p>Bạn đang có bản nháp chưa gửi trong phòng này.</p>
                        {draftPreview && <p style={{ overflowWrap: 'anywhere' }}>Nháp: “{draftPreview}”</p>}
                        <p>Bản nháp chỉ bị xóa sau khi rời phòng thành công. Hủy sẽ giữ nguyên bản nháp.</p>
                    </div>
                )}

                <p>Rời phòng không xóa phòng trên máy chủ. Sau khi rời thành công, bạn không thể gửi tin vào phòng này.</p>

                {isOwner && <p role="alert">Bạn là chủ phòng nên không thể tự rời. Hệ thống chưa hỗ trợ chuyển chủ phòng.</p>}
                {hasLeft && <p role="status">Bạn đã rời phòng này.</p>}
                {!currentUser && <p role="alert">Cần đăng nhập để rời phòng.</p>}
                {status === 'pending' && <p role="status">Đang xử lý yêu cầu. Đóng hộp không hủy yêu cầu đã gửi.</p>}
                {request && status !== 'pending' && (
                    <p role={status === 'success' ? 'status' : 'alert'} style={{ color: status === 'success' ? '#166534' : '#b42318' }}>
                        {request.message}
                    </p>
                )}

                <form onSubmit={confirm} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                    <button type="button" onClick={onClose} style={buttonStyle}>Hủy</button>
                    <button
                        type="submit"
                        disabled={cannotLeave || locked}
                        style={{ ...buttonStyle, background: '#2563eb', color: '#fff', borderColor: '#2563eb', opacity: cannotLeave || locked ? 0.6 : 1 }}
                    >
                        {status === 'pending' ? 'Đang rời...' : 'Xác nhận rời phòng'}
                    </button>
                </form>
            </section>
        </div>
    )
}
