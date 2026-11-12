import { privateChat, sameNameRoom } from '../fixtures/chat'
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
                <div className="chat-preview-choices">
                    <button type="button" onClick={() => onSelectConversation(privateChat)}>Chat riêng mẫu</button>
                    <button type="button" onClick={() => onSelectConversation(sameNameRoom)}>Phòng chat mẫu</button>
                    <button type="button" onClick={() => onSelectConversation({ kind: 'room', name: 'phong_trong' })}>Lịch sử trống</button>
                    <button type="button" onClick={() => onSelectConversation({ kind: 'people', name: 'ban_mau' })}>Lỗi tải lịch sử</button>
                </div>
            )}
        </aside>
    )
}
