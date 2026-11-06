import type { ConversationRef } from '../types/api'

interface SidebarProps {
    onSelectConversation: (conversation: ConversationRef) => void
}

export default function SidebarPlaceholder({ onSelectConversation }: SidebarProps) {
    return (
        <aside className="chat-sidebar" aria-label="Danh sách hội thoại">
            <h2>Hội thoại</h2>
            <p>Vùng danh sách của Khôi.</p>
            {import.meta.env.DEV && (
                <button onClick={() => onSelectConversation({ kind: 'people', name: 'ban_mau' })}>
                    Mở hội thoại mẫu
                </button>
            )}
        </aside>
    )
}
