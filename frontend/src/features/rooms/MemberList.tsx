import type { CSSProperties } from 'react'
import type { MemberListProps, RoomConversationRef } from '../../types/room'
import './room-mobile.css'

type Props = MemberListProps & {
    loadedAt?: string
    onRequestLeave?: (conversation: RoomConversationRef) => void
    leaveRejection?: string
}

const buttonStyle: CSSProperties = {
    padding: '10px 14px',
    border: '1px solid #d8dfe8',
    borderRadius: 8,
    background: '#fff',
    color: '#182333',
    cursor: 'pointer',
}

export default function MemberList({
                                       room, currentUser, loading, error, onRefresh, onClose, loadedAt, onRequestLeave, leaveRejection,
                                   }: Props) {
    const conversation: RoomConversationRef = { kind: 'room', name: room.name }
    const members = room.membersKnown && Array.isArray(room.members) ? room.members : null
    const isOwner = room.ownerKnown
        ? !!currentUser && room.owner === currentUser
        : room.membership === 'owner'
    const hasLeft = room.membership === 'left'

    return (
        <aside
            className="cv48-members-panel"
            aria-label={`Thành viên phòng ${room.name}`}
            aria-busy={loading}
            style={{
                width: 'min(100%, 360px)',
                minWidth: 0,
                boxSizing: 'border-box',
                padding: 20,
                background: '#fff',
                color: '#182333',
                border: '1px solid #d8dfe8',
                borderRadius: 12,
            }}
        >
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 20, margin: 0 }}>
                    Thành viên {members ? `· ${members.length}` : ''}
                </h2>
                <button type="button" onClick={onClose} style={{ ...buttonStyle, border: 0, color: '#2563eb' }}>
                    Đóng
                </button>
            </header>

            <p style={{ color: '#64748b' }}>{room.name} · Phòng chat</p>
            {room.ownerKnown && room.owner && (
                <p>Chủ phòng: <strong>{room.owner}</strong></p>
            )}
            {!room.ownerKnown && <p>Chưa xác định được chủ phòng.</p>}
            <p role="status">Quyền phòng: {leaveRejection
                ? 'Cần xác minh (OUT_ROOM đã bị từ chối)'
                : room.membership === 'member' ? 'Thành viên (theo dữ liệu đã xác nhận trước đó)'
                    : room.membership === 'owner' ? 'Chủ phòng'
                        : room.membership === 'left' ? 'Đã rời phòng' : 'Chưa xác định'}</p>
            {leaveRejection && (
                <p role="alert" style={{ color: '#b42318' }}>
                    Máy chủ từ chối OUT_ROOM: {leaveRejection}. Danh sách bên dưới lấy từ GET_ROOM_CHAT_MES,
                    không xác nhận quyền rời/gửi hiện tại. Có thể làm mới để đối chiếu hoặc chủ động chọn
                    “Tham gia phòng” ở danh sách hội thoại. Hệ thống không tự JOIN_ROOM.
                </p>
            )}
            {leaveRejection && currentUser && <p>Đối chiếu userList: {room.membersKnown
                ? room.members?.includes(currentUser) ? 'còn liệt kê tài khoản này' : 'không liệt kê tài khoản này'
                : 'chưa có dữ liệu thành viên hợp lệ'}.</p>}

            <button type="button" disabled={loading} onClick={() => onRefresh(conversation)} style={buttonStyle}>
                {loading ? 'Đang tải...' : error ? 'Thử lại' : 'Làm mới'}
            </button>

            {loading && <p role="status">{members ? 'Đang làm mới danh sách...' : 'Đang tải thành viên...'}</p>}
            {error && (
                <p role="alert" style={{ color: '#b42318' }}>
                    {error.message}
                    {members && ' Danh sách đang hiển thị có thể đã cũ.'}
                </p>
            )}

            {members === null && !loading && !error && <p>Chưa có thông tin danh sách thành viên.</p>}
            {members?.length === 0 && !loading && <p>Danh sách thành viên trống.</p>}

            {members && members.length > 0 && (
                <ul className="cv48-members-list" style={{ listStyle: 'none', margin: '18px 0', padding: 0 }}>
                    {members.map(username => {
                        const owner = room.ownerKnown && room.owner === username
                        const me = currentUser === username
                        const role = owner ? 'Chủ phòng' : 'Thành viên'
                        const displayedRole = me && room.membership === 'left'
                            ? 'Bạn · Đã rời phòng (danh sách có thể cũ)'
                            : me && leaveRejection
                                ? 'Bạn · Có trong danh sách, quyền chưa xác minh'
                                : me ? `Bạn · ${role}` : role

                        return (
                            <li key={username} style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                                gap: 8,
                                padding: '12px 0',
                                borderBottom: '1px solid #e2e8f0',
                            }}>
                                <span>{username}</span>
                                <span style={{ color: '#64748b' }}>{displayedRole}</span>
                            </li>
                        )
                    })}
                </ul>
            )}

            {loadedAt && members && <p style={{ color: '#64748b' }}>Đã tải lúc {loadedAt}. Danh sách có thể thay đổi.</p>}

            {isOwner && <p>Chủ phòng không thể tự rời phòng.</p>}
            {hasLeft && <p>Bạn đã rời phòng này.</p>}
            <button
                type="button"
                disabled={!onRequestLeave || isOwner || hasLeft || !currentUser}
                onClick={() => onRequestLeave?.(conversation)}
                style={{ ...buttonStyle, marginTop: 12 }}
            >
                Rời phòng
            </button>
        </aside>
    )
}
