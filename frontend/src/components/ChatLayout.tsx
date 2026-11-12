import { useState } from 'react'
import { logout } from '../services/authApi'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { sessionCleared } from '../store/slices/authSlice'
import type { ConversationRef } from '../types/api'
import SidebarPlaceholder from './SidebarPlaceholder'
import ChatPage from '../features/chat/ChatPage'
import { mockChatService } from '../fixtures/mockChatService'
import { createConversationKey } from '../utils/conversationKey'

export default function ChatLayout() {
    const dispatch = useAppDispatch()
    const { currentUser, authStatus, connectionStatus, sessionGeneration } = useAppSelector(state => state.auth)
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
                <span role="status">{connectionStatus === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}</span>
                <button type="button" disabled={isLoggingOut} onClick={handleLogout}>
                    {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </button>
            </header>
            <div inert={isLoggingOut} className={`chat-columns${selectedConversation ? ' has-conversation' : ''}`}>
                <SidebarPlaceholder onSelectConversation={setSelectedConversation} />
                <ChatPage
                    conversation={selectedConversation}
                    conversationKey={selectedConversation ? createConversationKey(selectedConversation) : null}
                    currentUser={currentUser}
                    authStatus={authStatus}
                    connectionStatus={connectionStatus}
                    sessionGeneration={sessionGeneration}
                    loadHistory={mockChatService.loadHistory}
                    onBack={() => setSelectedConversation(null)}
                />
            </div>
        </main>
    )
}
