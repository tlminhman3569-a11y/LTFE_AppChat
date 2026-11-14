import { useLayoutEffect, useRef } from 'react'
import type { ConversationKey, ConversationRef } from '../../types/api'
import type { ChatPageProps, ComposerProps } from '../../types/message'
import { useChat } from '../../hooks/useChat'
import Composer from './Composer'
import MessageList from './MessageList'
import './chat.css'

interface ChatProps extends ChatPageProps, Omit<ComposerProps, 'conversation'> {
    sentPreview: boolean
    conversationKey: ConversationKey | null
    reconnectCount?: number
    onBack: () => void
}

interface HistoryProps {
    conversation: ConversationRef
    currentUser: string | null
}

function ChatHistory({ conversation, currentUser }: HistoryProps) {
    const { messages, hasOlder, firstPage, loading, error, canLoad, loadNextPage } = useChat(conversation)
    const historyRef = useRef<HTMLDivElement>(null)
    const previousLength = useRef(0)
    const previousHeight = useRef(0)
    const previousNoticeHeight = useRef(0)
    const noticeRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const history = historyRef.current
        if (!history) return

        const noticeHeight = noticeRef.current?.offsetHeight ?? 0
        if (messages.length > previousLength.current) {
            history.scrollTop = previousLength.current === 0
                ? history.scrollHeight
                : history.scrollTop + history.scrollHeight - previousHeight.current
        } else if (messages.length > 0 && noticeHeight !== previousNoticeHeight.current) {
            history.scrollTop += noticeHeight - previousNoticeHeight.current
        }
        previousLength.current = messages.length
        previousHeight.current = history.scrollHeight
        previousNoticeHeight.current = noticeHeight
    }, [messages, hasOlder, loading, error, canLoad])

    return (
        <div className="chat-history" ref={historyRef} aria-busy={loading}>
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
                    <div className="chat-history-notice" ref={noticeRef}>
                        {hasOlder ? (
                            <button type="button" disabled={loading || !canLoad} onClick={loadNextPage}>
                                {loading ? 'Đang tải tin cũ…' : error ? 'Thử tải lại tin cũ' : 'Xem tin cũ hơn'}
                            </button>
                        ) : <p role="status">Đã xem hết lịch sử.</p>}
                        {error && <p role="alert">{error}</p>}
                    </div>
                    <MessageList messages={messages} currentUser={currentUser} />
                </>
            )}
        </div>
    )
}

export default function ChatPage({
    conversation, conversationKey, currentUser, sessionGeneration, reconnectCount = 0, onBack,
    draft, canSend, onDraftChange, onSend, sentPreview,
}: ChatProps) {
    return (
        <section className="chat-content chat-page" aria-label="Nội dung hội thoại">
            {conversation && conversationKey !== null ? (
                <>
                    <header className="chat-heading">
                        <button type="button" className="mobile-back" onClick={onBack}>Quay lại danh sách</button>
                        <h2>{conversation.name}</h2>
                        <p>{conversation.kind === 'room' ? 'Phòng chat' : 'Chat riêng'}</p>
                    </header>
                    <ChatHistory
                        key={JSON.stringify([sessionGeneration, conversationKey, reconnectCount])}
                        conversation={conversation}
                        currentUser={currentUser}
                    />
                    {sentPreview && <p role="status" className="chat-composer-status">Đã thử thao tác gửi. Tin nhắn chưa được gửi lên máy chủ.</p>}
                    <Composer
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
