import type { Message } from '../../types/message'

interface MessageListProps {
    messages: Message[]
    currentUser: string | null
}

export default function MessageList({ messages, currentUser }: MessageListProps) {
    return (
        <ul className="chat-messages" aria-label="Tin nhắn">
            {messages.map((message, index) => (
                <li
                    key={message.id ?? `message-${index}`}
                    className={message.name === currentUser ? 'chat-message chat-message-own' : 'chat-message'}
                >
                    <strong>{message.name}</strong>
                    <p>{message.mes.startsWith('APPCHAT_RICH_V1') ? 'Tin nhắn có định dạng' : message.mes}</p>
                    {message.createAt && <small>{message.createAt} · Giờ máy chủ</small>}
                </li>
            ))}
        </ul>
    )
}
