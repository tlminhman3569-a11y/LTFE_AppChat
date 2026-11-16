import type { Message } from '../types/message'
import { parseRichMessage } from '../utils/richMessage'

interface MessageBubbleProps {
    message: Message
    currentUser: string | null
}

export default function MessageBubble({ message, currentUser }: MessageBubbleProps) {
    const isOwnMessage = message.name === currentUser
    const content = parseRichMessage(message.mes)

    return (
        <li className={isOwnMessage ? 'chat-message chat-message-own' : 'chat-message'}>
            <strong>{message.name}</strong>
            <p>{content ? content.runs.map((run, index) => (
                <span key={index} style={{
                    fontWeight: run.bold ? 'bold' : 'normal',
                    fontStyle: run.italic ? 'italic' : 'normal',
                    fontSize: run.size,
                }}>
                    {run.text}
                </span>
            )) : message.mes}</p>
            {message.createAt && <small>{message.createAt} · Giờ máy chủ</small>}
        </li>
    )
}
