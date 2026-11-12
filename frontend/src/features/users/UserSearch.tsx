import type { OnSelectConversation, RecentConversation } from '../../types/user'

interface Props {
    conversations: RecentConversation[]
    query: string
    loading?: boolean
    error?: string | null
    onRetry?: () => void
    onSelectConversation: OnSelectConversation
}

export default function UserSearch({
    conversations,
    query,
    loading = false,
    error = null,
    onRetry,
    onSelectConversation,
}: Props) {
    const keyword = query.trim().toLowerCase()
    const users = conversations.filter((item) =>
        item.kind === 'people' && item.name.toLowerCase().includes(keyword)
    )

    if (loading) {
        return <p role="status">Đang tải người dùng...</p>
    }

    if (error) {
        return (
            <div role="alert">
                <p>Không tải được người dùng: {error}</p>
                {onRetry && <button type="button" onClick={onRetry}>Thử lại</button>}
            </div>
        )
    }

    if (users.length === 0) {
        return <p>Không có gợi ý phù hợp trong danh sách gần đây. Có thể người dùng vẫn tồn tại trên hệ thống.</p>
    }

    return (
        <ul aria-label="Gợi ý người dùng">
            {users.map((user) => (
                <li key={`people:${user.name}`}>
                    <button
                        type="button"
                        onClick={() => onSelectConversation({ kind: 'people', name: user.name })}
                    >
                        {user.name}
                    </button>
                </li>
            ))}
        </ul>
    )
}
