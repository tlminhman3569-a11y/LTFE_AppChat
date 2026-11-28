import type { Message, OutgoingMessage } from '../types/message'
import { parseRichMessage } from '../utils/richMessage'
import { parseImageMessage } from '../utils/imageMessage'
import { imageMessagePrefix } from '../types/media'

interface MessageBubbleProps {
    message: Message
    currentUser: string | null
    pending?: boolean
    pendingStatus?: OutgoingMessage['status']
    onRetry?: () => void
}

export default function MessageBubble({ message, currentUser, pending = false, pendingStatus = 'unconfirmed', onRetry }: MessageBubbleProps) {
    const isOwnMessage = pending || message.name === currentUser
    const content = parseRichMessage(message.mes)
    const imageContent = parseImageMessage(message.mes)

    return (
        <li className={isOwnMessage ? 'chat-message chat-message-own' : 'chat-message'}>
            {!pending && <strong>{message.name}</strong>}
            {imageContent ? <img className="chat-message-image" src={imageContent.image.url}
                alt="Ảnh trong tin nhắn" loading="lazy" referrerPolicy="no-referrer" />
                : <p>{message.mes.startsWith(imageMessagePrefix) ? 'Tin ảnh không hợp lệ.' : content ? content.runs.map((run, index) => (
                <span key={index} style={{
                    fontWeight: run.bold ? 'bold' : 'normal',
                    fontStyle: run.italic ? 'italic' : 'normal',
                    fontSize: run.size,
                }}>
                    {run.text}
                </span>
            )) : message.mes}</p>}
            {pending ? <small>{pendingStatus === 'pending' ? 'Đang chờ xác nhận'
                : pendingStatus === 'failed' ? 'Gửi thất bại' : 'Chưa xác nhận'}</small>
                : message.createAt && <small>{message.createAt} · Giờ máy chủ</small>}
            {!pending && isOwnMessage && message.deliveryStatus === 'saved' && <small>Đã lưu</small>}
            {onRetry && <button type="button" onClick={onRetry}>Sửa / thử lại</button>}
        </li>
    )
}
