import type { ApiResult, ConversationRef } from '../types/api'
import type { HistoryPage, Message } from '../types/message'
import { loadRoom } from './roomsApi'
import { socketClient, SocketRequestError } from './socketClient'

function readMessage(value: unknown): Message | null {
    if (!value || typeof value !== 'object') return null
    if (!('type' in value) || (value.type !== 0 && value.type !== 1)
        || !('name' in value) || typeof value.name !== 'string' || !value.name.trim()
        || !('to' in value) || typeof value.to !== 'string' || !value.to.trim()
        || !('mes' in value) || typeof value.mes !== 'string') return null

    const message: Message = { kind: value.type === 0 ? 'people' : 'room', name: value.name, to: value.to, mes: value.mes }
    if ('id' in value && (typeof value.id === 'string' || typeof value.id === 'number')) message.id = value.id
    if ('createAt' in value && typeof value.createAt === 'string') message.createAt = value.createAt
    return message
}

function invalidHistory(): ApiResult<never> {
    return { status: 'error', error: { kind: 'parse', message: 'Phản hồi lịch sử không hợp lệ' } }
}

export async function loadHistory(conversation: ConversationRef, page: number, currentUser: string | null): Promise<ApiResult<HistoryPage>> {
    if (!conversation.name.trim() || !Number.isInteger(page) || page < 1) {
        return { status: 'error', error: { kind: 'business', message: 'Cần tên hội thoại và số trang hợp lệ' } }
    }

    if (conversation.kind === 'room') {
        const result = await loadRoom(conversation.name, page)
        if (result.status !== 'success') return result

        // CV45 cần bàn giao kiểu Message cho dữ liệu phòng chuẩn hóa.
        return { status: 'error', error: { kind: 'parse', message: 'Chưa có hợp đồng dữ liệu lịch sử phòng từ CV45' } }
    }

    if (!currentUser?.trim()) {
        return { status: 'error', error: { kind: 'session', message: 'Cần tài khoản hiện tại để đọc lịch sử chat riêng' } }
    }

    try {
        const reply = await socketClient.request('GET_PEOPLE_CHAT_MES', { name: conversation.name, page })
        if (reply.status === 'error') {
            return { status: 'error', error: { kind: 'business', message: 'Máy chủ từ chối tải lịch sử chat riêng' } }
        }
        if (reply.status !== 'success' || !Array.isArray(reply.data)) return invalidHistory()

        const messages: Message[] = []
        for (const item of reply.data) {
            const message = readMessage(item)
            if (!message || message.kind !== 'people') return invalidHistory()
            const isIncoming = message.name === conversation.name && message.to === currentUser
            const isOutgoing = message.name === currentUser && message.to === conversation.name
            if (!isIncoming && !isOutgoing) {
                return invalidHistory()
            }
            messages.push(message)
        }

        return { status: 'success', data: { conversation, page, messages } }
    } catch (error) {
        if (error instanceof SocketRequestError && error.kind === 'timeout') {
            return { status: 'error', error: { kind: 'timeout', message: 'Hết thời gian chờ lịch sử chat riêng' } }
        }
        return { status: 'error', error: { kind: 'connection', message: 'Không thể kết nối để tải lịch sử' } }
    }
}

export function sendText(conversation: ConversationRef, text: string): void {
    if (!conversation.name.trim() || !text.trim()) throw new Error('Cần hội thoại và nội dung tin nhắn')
    socketClient.send(JSON.stringify({
        action: 'onchat',
        data: { event: 'SEND_CHAT', data: { type: conversation.kind, to: conversation.name, mes: text } },
    }))
}

export function subscribeToMessages(
    currentUser: string,
    onMessage: (conversation: ConversationRef, message: Message) => void,
    onError: () => void,
) {
    return socketClient.subscribe('SEND_CHAT', response => {
        if (response.status === 'error') {
            onError()
            return
        }
        if (response.status !== 'success') return
        const message = readMessage(response.data)
        if (!message) return
        // Tin phát về cho chính người gửi không xác nhận được tin tạm.
        if (message.name === currentUser) return
        if (message.kind === 'people' && message.to !== currentUser) return

        const name = message.kind === 'room' ? message.to : message.name
        onMessage({ kind: message.kind, name }, message)
    })
}
