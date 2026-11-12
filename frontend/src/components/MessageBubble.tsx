import type { Message } from '../types/message'

interface MessageBubbleProps {
    message: Message
    currentUser: string | null
}

export default function MessageBubble({ message, currentUser }: MessageBubbleProps) {
    const isOwnMessage = message.name === currentUser
    const text = message.clientMessageId && message.mes.startsWith('APPCHAT_RICH_V1')
        ? 'Tin nhắn có định dạng'
        : message.mes

    return (
        <li className={isOwnMessage ? 'chat-message chat-message-own' : 'chat-message'}>
            <strong>{message.name}</strong>
            <p>{text}</p>
            {message.createAt && <small>{message.createAt} · Giờ máy chủ</small>}
        </li>
    )
}
