import MessageBubble from '../../components/MessageBubble.tsx'
import type { Message } from '../../types/message.ts'

interface MessageListProps {
    messages: Message[]
    currentUser: string | null
}

export default function MessageList({ messages, currentUser }: MessageListProps) {
    return (
        <ul className="chat-messages" aria-label="Tin nhắn">
            {messages.map((message, index) => (
                <MessageBubble
                    key={message.id ?? `message-${index}`}
                    message={message}
                    currentUser={currentUser}
                />
            ))}
        </ul>
    )
}
