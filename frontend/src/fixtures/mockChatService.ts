import type { ChatService } from '../types/message'
import { createConversationKey } from '../utils/conversationKey'
import { chatHistory } from './chat'
import { loadRoom } from './mockServices'

export const mockChatService: ChatService = {
    async loadHistory(conversation, page) {
        if (!Number.isInteger(page) || page < 1) {
            return { status: 'error', error: { kind: 'business', message: 'Trang phải từ 1 trở lên' } }
        }

        if (conversation.kind === 'room') {
            const result = await loadRoom(conversation.name, page)
            if (result.status !== 'success') return result

            return {
                status: 'success',
                data: { conversation, page: result.data.page, messages: result.data.messages },
            }
        }

        const pages = chatHistory[createConversationKey(conversation)]
        if (!pages) {
            return { status: 'error', error: { kind: 'business', message: 'Không có hội thoại này trong fixture' } }
        }

        return { status: 'success', data: { conversation, page, messages: pages[page] ?? [] } }
    },

    async send() {
        return {
            status: 'unknown',
            error: { kind: 'timeout', message: 'Fixture mô phỏng tin chưa xác nhận' },
        }
    },
}
