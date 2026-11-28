import type { ReactNode } from 'react'
import type { ConversationKey, ConversationRef } from '../../types/api'
import type { ChatPageProps, ComposerProps, OutgoingMessage } from '../../types/message'
import { useChat } from '../../hooks/useChat'
import Composer from './Composer'
import MessageList from './MessageList'
import MessageBubble from '../../components/MessageBubble'
import { useHistoryScroll } from './useHistoryScroll'
import { useChatViewport } from './useChatViewport'
import './chat.css'

export interface ChatProps extends ChatPageProps, Omit<ComposerProps, 'conversation'> {
    pending: OutgoingMessage[]
    checkingHistory?: boolean
    reconcileError?: string
    onCheckHistory?: () => void
    onRestorePending?: (message: OutgoingMessage) => void
    sendError: string
    conversationKey: ConversationKey | null
    reconnectCount?: number
    headerActions?: ReactNode
    onBack: () => void
}

interface HistoryProps {
    conversation: ConversationRef
    currentUser: string | null
}

function ChatHistory({ conversation, currentUser }: HistoryProps) {
    const { messages, hasOlder, needsRefresh, firstPage, loading, error, canLoad, loadNextPage } = useChat(conversation)
    const { historyRef, hasNewMessages, handleScroll, scrollToLatest } = useHistoryScroll(messages)
    let historyAction = 'Xem tin cũ hơn'
    if (needsRefresh) historyAction = loading ? 'Đang cập nhật lịch sử…' : 'Thử cập nhật lịch sử'
    else if (loading) historyAction = 'Đang tải tin cũ…'
    else if (error) historyAction = 'Thử tải lại tin cũ'

    return (
        <div className="chat-history-area">
            <div className="chat-history" ref={historyRef} onScroll={handleScroll} aria-busy={loading} tabIndex={0} aria-label="Lịch sử tin nhắn">
                {firstPage && loading && <p role="status">Đang tải lịch sử tin nhắn…</p>}
                {firstPage && error && (
                    <div className="chat-history-notice">
                        <p role="alert">Không tải được lịch sử. {error}</p>
                        <button type="button" disabled={!canLoad} onClick={loadNextPage}>Thử lại</button>
                    </div>
                )}
                {!canLoad && <p role="status">Cần kết nối để tải lịch sử tin nhắn.</p>}
                {!hasOlder && messages.length === 0 && <p role="status">Chưa có tin nhắn.</p>}
                {messages.length > 0 && (
                    <>
                        <div className="chat-history-notice">
                            {hasOlder || needsRefresh ? (
                                <button type="button" disabled={loading || !canLoad} onClick={loadNextPage}>
                                    {historyAction}
                                </button>
                            ) : <p role="status">Đã xem hết lịch sử.</p>}
                            {error && <p role="alert">{error}</p>}
                        </div>
                        <MessageList messages={messages} currentUser={currentUser} />
                    </>
                )}
            </div>
            {hasNewMessages && <button type="button" className="chat-new-messages" onClick={scrollToLatest}>Có tin mới</button>}
        </div>
    )
}

export default function ChatPage({
    conversation, conversationKey, currentUser, connectionStatus, sessionGeneration, onBack, headerActions,
    draft, canSend, onDraftChange, onSend, pending, sendError, checkingHistory, reconcileError, onCheckHistory, onRestorePending, imagePicker,
}: ChatProps) {
    const pageRef = useChatViewport(conversationKey)
    return (
        <section className="chat-content chat-page" ref={pageRef} aria-label="Nội dung hội thoại">
            {conversation && conversationKey !== null ? (
                <>
                    <header className="chat-heading">
                        <button type="button" className="mobile-back" onClick={onBack}>Quay lại danh sách</button>
                        <h2>{conversation.name}</h2>
                        <p>{conversation.kind === 'room' ? 'Phòng chat' : 'Chat riêng'}</p>
                        {headerActions}
                    </header>
                    <div className="chat-body">
                        <ChatHistory
                            key={JSON.stringify([sessionGeneration, conversationKey])}
                            conversation={conversation}
                            currentUser={currentUser}
                        />
                        {pending.length > 0 && (
                            <ul className="chat-messages chat-pending" aria-label="Tin chưa xác nhận">
                                {pending.map(message => (
                                    <MessageBubble key={message.localId} message={message} currentUser={currentUser}
                                        pending pendingStatus={message.status}
                                        onRetry={onRestorePending && message.status !== 'pending' ? () => {
                                            if (window.confirm('Tin cũ có thể đã được lưu. Gửi lại có thể tạo tin trùng. Đưa nội dung vào ô soạn để kiểm tra trước khi gửi lại?')) {
                                                onRestorePending(message)
                                            }
                                        } : undefined}
                                    />
                                ))}
                            </ul>
                        )}
                        {pending.length > 0 && onCheckHistory && (
                            <button type="button" disabled={checkingHistory || connectionStatus !== 'connected'}
                                onClick={onCheckHistory}>
                                {checkingHistory ? 'Đang đối chiếu…' : 'Đối chiếu lịch sử trước khi thử lại'}
                            </button>
                        )}
                        {reconcileError && <p role="alert" className="chat-composer-status">Không đối chiếu được lịch sử. {reconcileError}</p>}
                        {sendError && <p role="alert" className="chat-composer-status">{sendError}</p>}
                    </div>
                    <Composer
                        imagePicker={imagePicker}
                        key={conversationKey}
                        conversation={conversation}
                        draft={draft}
                        canSend={canSend}
                        onDraftChange={onDraftChange}
                        onSend={onSend}
                    />
                </>
            ) : <p className="chat-no-selection">Chọn một hội thoại để xem tin nhắn.</p>}
        </section>
    )
}
