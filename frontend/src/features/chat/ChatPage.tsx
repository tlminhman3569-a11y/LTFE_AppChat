import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ConversationKey, ConversationRef } from '../../types/api'
import type { ChatPageProps, ChatService, ComposerProps, Message } from '../../types/message'
import Composer from './Composer'
import MessageList from './MessageList'
import './chat.css'

interface ChatProps extends ChatPageProps, Omit<ComposerProps, 'conversation'> {
    sentPreview: boolean
    conversationKey: ConversationKey | null
    reconnectCount?: number
    loadHistory: ChatService['loadHistory']
    onBack: () => void
}

interface HistoryProps {
    conversation: ConversationRef
    currentUser: string | null
    loadHistory: ChatService['loadHistory']
}

function ChatHistory({ conversation, currentUser, loadHistory }: HistoryProps) {
    const { kind, name } = conversation
    const [attempt, setAttempt] = useState(0)
    const [messages, setMessages] = useState<Message[]>([])
    const [page, setPage] = useState(1)
    const [hasOlder, setHasOlder] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [olderError, setOlderError] = useState('')
    const historyRef = useRef<HTMLDivElement>(null)
    const previousScroll = useRef<{ top: number; height: number } | null>(null)
    const olderRequest = useRef<AbortController | null>(null)

    useEffect(() => {
        let active = true

        async function loadFirstPage() {
            try {
                const result = await loadHistory({ kind, name }, 1)
                if (!active) return

                if (result.status === 'success') {
                    setMessages(result.data.messages)
                    setHasOlder(result.data.messages.length > 0)
                } else {
                    setError(result.error.message)
                }
            } catch {
                if (active) setError('Không tải được lịch sử tin nhắn.')
            } finally {
                if (active) setLoading(false)
            }
        }

        void loadFirstPage()
        return () => {
            active = false
            olderRequest.current?.abort()
        }
    }, [attempt, kind, name, loadHistory])

    useLayoutEffect(() => {
        const history = historyRef.current
        if (!history) return

        const previous = previousScroll.current
        history.scrollTop = previous
            ? previous.top + history.scrollHeight - previous.height
            : history.scrollHeight
        previousScroll.current = null
    }, [messages])

    async function loadOlder() {
        if (olderRequest.current || !hasOlder) return

        const request = new AbortController()
        olderRequest.current = request
        setLoadingOlder(true)
        setOlderError('')
        try {
            const result = await loadHistory({ kind, name }, page + 1)
            if (request.signal.aborted) return

            if (result.status !== 'success') {
                setOlderError(result.error.message)
                return
            }

            if (result.data.messages.length === 0) {
                setHasOlder(false)
                return
            }

            const knownIds = new Set(messages.flatMap(message => message.id == null ? [] : [String(message.id)]))
            const olderMessages = result.data.messages.filter(message => {
                if (message.id == null) return true
                const id = String(message.id)
                if (knownIds.has(id)) return false
                knownIds.add(id)
                return true
            })
            if (olderMessages.length > 0) {
                const history = historyRef.current
                if (history) previousScroll.current = { top: history.scrollTop, height: history.scrollHeight }
                setMessages([...olderMessages, ...messages])
            }
            setPage(result.data.page)
        } catch {
            if (!request.signal.aborted) setOlderError('Không tải được tin nhắn cũ.')
        } finally {
            olderRequest.current = null
            if (!request.signal.aborted) setLoadingOlder(false)
        }
    }

    return (
        <div className="chat-history" ref={historyRef} aria-busy={loading || loadingOlder}>
            {loading && <p role="status">Đang tải lịch sử tin nhắn…</p>}
            {error && (
                <div className="chat-history-notice">
                    <p role="alert">Không tải được lịch sử. {error}</p>
                    <button type="button" onClick={() => {
                        setError('')
                        setLoading(true)
                        setAttempt(attempt + 1)
                    }}>Thử lại</button>
                </div>
            )}
            {!loading && !error && messages.length === 0 && <p role="status">Chưa có tin nhắn.</p>}
            {messages.length > 0 && (
                <>
                    <div className="chat-history-notice">
                        {hasOlder ? (
                            <button type="button" disabled={loadingOlder} onClick={() => void loadOlder()}>
                                {loadingOlder ? 'Đang tải tin cũ…' : olderError ? 'Thử tải lại tin cũ' : 'Xem tin cũ hơn'}
                            </button>
                        ) : <p role="status">Đã xem hết lịch sử.</p>}
                        {olderError && <p role="alert">{olderError}</p>}
                    </div>
                    <MessageList messages={messages} currentUser={currentUser} />
                </>
            )}
        </div>
    )
}

export default function ChatPage({
    conversation, conversationKey, currentUser, sessionGeneration, reconnectCount = 0, loadHistory, onBack,
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
                        loadHistory={loadHistory}
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
