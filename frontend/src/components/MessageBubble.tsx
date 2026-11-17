import type { Message } from '../types/message'
import { parseRichMessage } from '../utils/richMessage'

interface MessageBubbleProps {
    message: Message
    currentUser: string | null
    pending?: boolean
}

export default function MessageBubble({ message, currentUser, pending = false }: MessageBubbleProps) {
    const isOwnMessage = pending || message.name === currentUser
    const content = parseRichMessage(message.mes)

    return (
        <li className={isOwnMessage ? 'chat-message chat-message-own' : 'chat-message'}>
            {!pending && <strong>{message.name}</strong>}
            <p>{content ? content.runs.map((run, index) => (
                <span key={index} style={{
                    fontWeight: run.bold ? 'bold' : 'normal',
                    fontStyle: run.italic ? 'italic' : 'normal',
                    fontSize: run.size,
                }}>
                    {run.text}
                </span>
            )) : message.mes}</p>
            {pending ? <small>Chưa xác nhận</small>
                : message.createAt && <small>{message.createAt} · Giờ máy chủ</small>}
        </li>
    )
}
