import { useEffect, useEffectEvent, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { retrySocketConnection } from '../features/auth/reconnectSession'
import { sendText, subscribeToMessages } from '../services/chatApi'
import { markViewed, messageReceived } from '../store/slices/messagesSlice'
import { logout } from '../services/authApi'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { sessionCleared } from '../store/slices/authSlice'
import type { ConversationRef } from '../types/api'
import ConversationSidebar from './ConversationSidebar'
import ChatPage from '../features/chat/ChatPage'
import { useChatDrafts } from '../features/chat/useChatDrafts'
import type { Message } from '../types/message'
import { createConversationKey } from '../utils/conversationKey'

export default function ChatLayout() {
    const dispatch = useAppDispatch()
    const { currentUser, authStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const { connectionStatus, reconnectCount, canUseSocket } = useSocket()
    const [selectedConversation, setSelectedConversation] = useState<ConversationRef | null>(null)

    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [pending, setPending] = useState<(Message & { localId: string })[]>([])
    const [sendError, setSendError] = useState('')
    const { getDraft, updateDraft, hasAnyDraft, clearDraft } = useChatDrafts()
    const conversationKey = selectedConversation ? createConversationKey(selectedConversation) : null
    const canSend = canUseSocket && !isLoggingOut && selectedConversation?.kind === 'people'

    const receiveMessage = useEffectEvent((conversation: ConversationRef, message: Message) => {
        if (!canUseSocket || isLoggingOut) return
        dispatch(messageReceived({
            conversation, message, viewed: createConversationKey(conversation) === conversationKey,
        }))
    })

    useEffect(() => {
        if (!currentUser || !canUseSocket || isLoggingOut) return
        return subscribeToMessages(
            currentUser,
            (conversation, message) => receiveMessage(conversation, message),
            () => setSendError('Máy chủ báo lỗi gửi. Các tin chưa xác nhận cần được đối chiếu.'),
        )
    }, [currentUser, canUseSocket, isLoggingOut])

    function selectConversation(conversation: ConversationRef | null) {
        setSendError('')
        if (conversation) dispatch(markViewed(createConversationKey(conversation)))
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
                <span role="status">{canUseSocket ? 'Đã kết nối'
                    : connectionStatus === 'reconnecting' ? 'Đang kết nối lại…'
                        : 'Mất kết nối'}</span>
                {connectionStatus === 'disconnected' && (
                    <button type="button" disabled={isLoggingOut} onClick={retrySocketConnection}>
                        Thử kết nối lại
                    </button>
                )}
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
                    reconnectCount={reconnectCount}
                    draft={selectedConversation ? getDraft(selectedConversation) : []}
                    canSend={canSend}
                    onDraftChange={(conversation, draft) => {
                        setSendError('')
                        updateDraft(conversation, draft)
                    }}
                    onSend={(conversation, draft) => {
                        const text = draft.map(run => run.text).join('')
                        if (!canSend || !currentUser || !text.trim() || createConversationKey(conversation) !== conversationKey) return
                        const localId = crypto.randomUUID()
                        setSendError('')
                        try {
                            sendText(conversation, text)
                            setPending(previous => [...previous, {
                                localId, name: currentUser, kind: conversation.kind, to: conversation.name, mes: text,
                            }])
                            clearDraft(conversation)
                        } catch {
                            setSendError('Không gửi được tin nhắn. Bản nháp vẫn được giữ.')
                        }
                    }}
                    pending={pending.filter(message => message.kind === selectedConversation?.kind && message.to === selectedConversation.name)}
                    sendError={sendError}
                    onBack={() => selectConversation(null)}
                />
            </div>
        </main>
    )
}
