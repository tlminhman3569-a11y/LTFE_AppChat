import { useState } from 'react'
import { useAppSelector } from '../store/hooks'
import type { ConversationRef } from '../types/api'
import SidebarPlaceholder from './SidebarPlaceholder'
import ChatPlaceholder from './ChatPlaceholder'

export default function ChatLayout() {
    const { currentUser, connectionStatus } = useAppSelector(state => state.auth)
    const [selectedConversation, setSelectedConversation] = useState<ConversationRef | null>(null)

    return (
        <main className="chat-layout">
            <header className="session-bar">
                <h1>App Chat</h1>
                <span>{currentUser}</span>
                <span role="status">{connectionStatus === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}</span>
            </header>
            <div className={`chat-columns${selectedConversation ? ' has-conversation' : ''}`}>
                <SidebarPlaceholder onSelectConversation={setSelectedConversation} />
                <ChatPlaceholder conversation={selectedConversation} onBack={() => setSelectedConversation(null)} />
            </div>
        </main>
    )
}
