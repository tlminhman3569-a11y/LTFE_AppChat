import type { ConversationRef } from '../types/api'

interface ChatProps {
    conversation: ConversationRef | null
    onBack: () => void
}

export default function ChatPlaceholder({ conversation, onBack }: ChatProps) {
    return (
        <section className="chat-content" aria-label="Nội dung hội thoại">
            {conversation ? (
                <>
                    <button className="mobile-back" onClick={onBack}>Quay lại danh sách</button>
                    <h2>{conversation.name}</h2>
                    <p>Vùng tin nhắn và soạn tin của Kiệt.</p>
                </>
            ) : <p>Chọn một hội thoại để xem tin nhắn.</p>}
        </section>
    )
}
