import type { OnSelectConversation, RecentConversation } from '../../types/user'

interface Props {
    conversations: RecentConversation[]
    query: string
    loading?: boolean
    error?: string | null
    onRetry?: () => void
    onSelectConversation: OnSelectConversation
}

export default function RoomSearch({
    conversations,
    query,
    loading = false,
    error = null,
    onRetry,
    onSelectConversation,
}: Props) {
    const keyword = query.trim().toLowerCase()
    const rooms = conversations.filter((item) =>
        item.kind === 'room' && item.name.toLowerCase().includes(keyword)
    )

    if (loading) {
        return <p role="status">Đang tải phòng...</p>
    }

    if (error) {
        return (
            <div role="alert">
                <p>Không tải được phòng: {error}</p>
                {onRetry && <button type="button" onClick={onRetry}>Thử lại</button>}
            </div>
        )
    }

    if (rooms.length === 0) {
        return <p>Không có phòng phù hợp trong danh sách gần đây. Có thể phòng vẫn tồn tại trên hệ thống.</p>
    }

    return (
        <ul aria-label="Gợi ý phòng">
            {rooms.map((room) => (
                <li key={`room:${room.name}`}>
                    <button
                        type="button"
                        onClick={() => onSelectConversation({ kind: 'room', name: room.name })}
                    >
                        {room.name}
                    </button>
                </li>
            ))}
        </ul>
    )
}
