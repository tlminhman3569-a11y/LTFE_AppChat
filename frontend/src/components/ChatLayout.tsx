import { useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { logout } from '../services/authApi'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { sessionCleared } from '../store/slices/authSlice'
import type { ConversationRef } from '../types/api'
import ConversationSidebar from './ConversationSidebar'
import ChatPage from '../features/chat/ChatPage'
import { mockChatService } from '../fixtures/mockChatService'
import { createConversationKey } from '../utils/conversationKey'

export default function ChatLayout() {
    const dispatch = useAppDispatch()
    const { currentUser, authStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const { connectionStatus, reconnectCount, canUseSocket } = useSocket()
    const [selectedConversation, setSelectedConversation] = useState<ConversationRef | null>(null)

    const [isLoggingOut, setIsLoggingOut] = useState(false)

    async function handleLogout() {
        if (isLoggingOut) return
        setIsLoggingOut(true)

        const result = await logout()
        dispatch(sessionCleared({ logoutNotConfirmed: result.status !== 'success' }))
    }

    return (
        <main className="chat-layout">
            <header className="session-bar">
                <h1>App Chat</h1>
                <span>{currentUser}</span>
                <span role="status">{canUseSocket ? 'Đã kết nối'
                    : connectionStatus === 'reconnecting' ? 'Đang kết nối lại…'
                        : 'Mất kết nối'}</span>
                <button type="button" disabled={isLoggingOut} onClick={handleLogout}>
                    {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </button>
            </header>
            <div inert={isLoggingOut} className={`chat-columns${selectedConversation ? ' has-conversation' : ''}`}>
                <ConversationSidebar
                    selectedConversation={selectedConversation}
                    onSelectConversation={setSelectedConversation}
                    reconnectCount={reconnectCount}
                />
                <ChatPage
                    conversation={selectedConversation}
                    conversationKey={selectedConversation ? createConversationKey(selectedConversation) : null}
                    currentUser={currentUser}
                    authStatus={authStatus}
                    connectionStatus={connectionStatus}
                    sessionGeneration={sessionGeneration}
                    reconnectCount={reconnectCount}
                    loadHistory={mockChatService.loadHistory}
                    onBack={() => setSelectedConversation(null)}
                />
            </div>
        </main>
    )
}
