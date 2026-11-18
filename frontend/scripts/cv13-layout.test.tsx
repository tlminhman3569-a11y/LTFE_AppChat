import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatLayout from '../src/components/ChatLayout'
import ConversationList from '../src/components/ConversationList'
import ChatPage from '../src/features/chat/ChatPage'
import { store } from '../src/store'
import { sessionCleared, sessionStarted } from '../src/store/slices/authSlice'
import { messageReceived } from '../src/store/slices/messagesSlice'
import type { ConversationRef } from '../src/types/api'
import { createConversationKey } from '../src/utils/conversationKey'

const privateChat: ConversationRef = { kind: 'people', name: 'nhom_hoc' }
const roomChat: ConversationRef = { kind: 'room', name: 'nhom_hoc' }

function renderChat(conversation: ConversationRef, draft: string) {
    return renderToStaticMarkup(
        <Provider store={store}>
            <ConversationList
                conversations={[privateChat, roomChat]}
                selectedConversation={conversation}
                onSelectConversation={vi.fn()}
            />
            <ChatPage
                conversation={conversation}
                conversationKey={createConversationKey(conversation)}
                currentUser="demo"
                authStatus="authenticated"
                connectionStatus="connected"
                sessionGeneration={store.getState().auth.sessionGeneration}
                draft={[{ text: draft, size: 16, bold: false, italic: false }]}
                canSend={false}
                pending={[]}
                sendError=""
                onDraftChange={vi.fn()}
                onSend={vi.fn()}
                onBack={vi.fn()}
            />
        </Provider>,
    )
}

function selectedButton(html: string) {
    const buttons = html.match(/<button [^>]*>/g) ?? []
    const selected = buttons.filter(button => button.includes('aria-current="true"'))

    expect(selected).toHaveLength(1)
    return selected[0]
}

beforeEach(() => {
    store.dispatch(sessionCleared(undefined))
    store.dispatch(sessionStarted('demo'))
})

describe('Khung chat và danh sách hội thoại', () => {
    it('hiện danh sách khi chưa chọn hội thoại', () => {
        const page = (
            <Provider store={store}>
                <ChatLayout />
            </Provider>
        )

        const html = renderToStaticMarkup(page)

        expect(html).toContain('chat-sidebar')
        expect(html).toContain('Chọn một hội thoại để xem tin nhắn')
    })

    it('chat riêng và phòng trùng tên vẫn hiện đúng tin và nháp', () => {
        // Hai mục cùng tên nhưng mỗi mục có lịch sử riêng trong Redux
        store.dispatch(messageReceived({
            conversation: privateChat,
            message: { id: 1, name: 'nhom_hoc', to: 'demo', kind: 'people', mes: 'Mai đi học nha' },
            viewed: true,
        }))
        store.dispatch(messageReceived({
            conversation: roomChat,
            message: { id: 2, name: 'minh', to: 'nhom_hoc', kind: 'room', mes: 'Nhóm họp lúc 8 giờ' },
            viewed: true,
        }))

        const privateHtml = renderChat(privateChat, 'Mai gặp ở cổng trường')
        const roomHtml = renderChat(roomChat, 'Mình gửi slide sau')
        const privateButton = selectedButton(privateHtml)
        const roomButton = selectedButton(roomHtml)

        expect(privateButton).toContain('aria-label="Mở chat riêng nhom_hoc"')
        expect(privateHtml).toContain('Mai đi học nha')
        expect(privateHtml).toContain('Mai gặp ở cổng trường')
        expect(privateHtml).not.toContain('Nhóm họp lúc 8 giờ')
        expect(privateHtml).not.toContain('Mình gửi slide sau')

        expect(roomButton).toContain('aria-label="Mở phòng nhom_hoc"')
        expect(roomHtml).toContain('Nhóm họp lúc 8 giờ')
        expect(roomHtml).toContain('Mình gửi slide sau')
        expect(roomHtml).not.toContain('Mai đi học nha')
        expect(roomHtml).not.toContain('Mai gặp ở cổng trường')
    })
})
