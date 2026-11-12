import type { ConversationRef } from '../types/api'
import type { Message, PendingMessage, RichMessageContent, TextRun } from '../types/message'
import { createConversationKey } from '../utils/conversationKey'

export const privateChat: ConversationRef = { kind: 'people', name: 'minh_an' }
export const sameNameRoom: ConversationRef = { kind: 'room', name: 'minh_an' }

export const chatDraft: TextRun[] = [
    { text: 'Kế hoạch ôn bài', bold: true, italic: false, size: 18 },
    { text: '\nBắt đầu lúc 19 giờ 😊', bold: false, italic: true, size: 16 },
]

const richContent: RichMessageContent = {
    version: 1,
    clientMessageId: 'demo-rich-1',
    runs: chatDraft,
}

export const chatHistory: Record<string, Record<number, Message[]>> = {
    [createConversationKey(privateChat)]: {
        1: [
            { id: 2, kind: 'people', name: 'minh_an', to: 'kiet_demo', mes: 'Hẹn tối nay 😊', createAt: '2026-11-05 08:01:00' },
            {
                id: 3,
                kind: 'people',
                name: 'kiet_demo',
                to: 'minh_an',
                mes: 'APPCHAT_RICH_V1' + JSON.stringify(richContent),
                createAt: '2026-11-05 08:02:00',
                clientMessageId: richContent.clientMessageId,
            },
            { id: 4, kind: 'people', name: 'minh_an', to: 'kiet_demo', mes: 'APPCHAT_RICH_V1{"version":', createAt: '2026-11-05 08:03:00' },
        ],
        2: [
            { id: 1, kind: 'people', name: 'minh_an', to: 'kiet_demo', mes: 'Chào bạn, mình gửi lại lịch học nhé.', createAt: '2026-11-05 08:00:00' },
        ],
    },
    [createConversationKey(sameNameRoom)]: {
        1: [
            { id: 5, kind: 'room', name: 'khoi_demo', to: 'minh_an', mes: 'Tài liệu của phòng đây.', createAt: '2026-11-05 08:04:00' },
            { id: 6, kind: 'room', name: 'kiet_demo', to: 'minh_an', mes: '<b>Ghi chú dưới dạng văn bản</b>', createAt: '2026-11-05 08:05:00' },
        ],
    },
}

export const unconfirmedMessage: PendingMessage = {
    localId: 'demo-pending-1',
    conversation: privateChat,
    name: 'kiet_demo',
    content: { ...richContent, clientMessageId: 'demo-unconfirmed-1' },
    status: 'unconfirmed',
}
