import { useState } from 'react'
import { logout } from '../services/authApi'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { sessionCleared } from '../store/slices/authSlice'
import type { ConversationRef } from '../types/api'
import ConversationSidebar from './ConversationSidebar'
import ChatPage from '../features/chat/ChatPage'
import { useChatDrafts } from '../features/chat/useChatDrafts'
import { rooms } from '../fixtures/rooms'
import { mockChatService } from '../fixtures/mockChatService'
import { createConversationKey } from '../utils/conversationKey'

export default function ChatLayout() {
    const dispatch = useAppDispatch()
    const { currentUser, authStatus, connectionStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const [selectedConversation, setSelectedConversation] = useState<ConversationRef | null>(null)

    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [sentPreviewKey, setSentPreviewKey] = useState<string | null>(null)
    const { getDraft, updateDraft, hasAnyDraft, hasDraft, clearDraft } = useChatDrafts()
    const conversationKey = selectedConversation ? createConversationKey(selectedConversation) : null
    const membership = selectedConversation?.kind === 'room'
        ? rooms.find(room => room.name === selectedConversation.name)?.membership
        : undefined
    const canSend = import.meta.env.DEV && authStatus === 'authenticated' && connectionStatus === 'connected'
        && !isLoggingOut && (selectedConversation?.kind === 'people' || membership === 'member' || membership === 'owner')

    function selectConversation(conversation: ConversationRef | null) {
        setSentPreviewKey(null)
        setSelectedConversation(conversation)
    }

    async function handleLogout() {
        if (isLoggingOut) return
        if (hasAnyDraft() && !window.confirm('Bạn còn bản nháp. Đăng xuất sẽ xóa bản nháp. Tiếp tục?')) return
        setIsLoggingOut(true)

        const result = await logout()
        dispatch(sessionCleared({ logoutNotConfirmed: result.status !== 'success' }))
    }

    return (
        <main className="chat-layout">
            <header className="session-bar">
                <h1>App Chat</h1>
                <span>{currentUser}</span>
                <span role="status">{connectionStatus === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}</span>
                <button type="button" disabled={isLoggingOut} onClick={handleLogout}>
                    {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </button>
            </header>
            <div inert={isLoggingOut} className={`chat-columns${selectedConversation ? ' has-conversation' : ''}`}>
                <ConversationSidebar selectedConversation={selectedConversation} onSelectConversation={selectConversation} />
                <ChatPage
                    conversation={selectedConversation}
                    conversationKey={conversationKey}
                    currentUser={currentUser}
                    authStatus={authStatus}
                    connectionStatus={connectionStatus}
                    sessionGeneration={sessionGeneration}
                    loadHistory={mockChatService.loadHistory}
                    draft={selectedConversation ? getDraft(selectedConversation) : []}
                    canSend={canSend}
                    onDraftChange={(conversation, draft) => {
                        setSentPreviewKey(null)
                        updateDraft(conversation, draft)
                    }}
                    onSend={(conversation, draft) => {
                        if (!canSend || !hasDraft(conversation) || !draft.some(run => run.text.trim())) return
                        const key = createConversationKey(conversation)
                        if (key !== conversationKey) return
                        clearDraft(conversation)
                        setSentPreviewKey(key)
                    }}
                    sentPreview={conversationKey !== null && sentPreviewKey === conversationKey}
                    onBack={() => selectConversation(null)}
                />
            </div>
        </main>
    )
}
