import { sameTextRuns } from '../utils/matchesOutgoing'
import { useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react'
import { useSocket } from '../hooks/useSocket'
import { retrySocketConnection } from '../features/auth/reconnectSession'
import { sendText, subscribeToMessages } from '../services/chatApi'
import { markViewed, messageReceived, outgoingQueued, outgoingSendFailed, outgoingErrorReceived, outgoingExpired } from '../store/slices/messagesSlice'
import { endSession } from '../features/auth/endSession'
import LogoutDialog from '../features/auth/LogoutDialog'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type { ConversationRef } from '../types/api'
import ConversationSidebar from './ConversationSidebar'
import ChatPage from '../features/chat/ChatPage'
import RoomMembersPanel from '../features/rooms/RoomMembersPanel'
import { useChatDrafts } from '../features/chat/useChatDrafts'
import type { Message, OutgoingMessage } from '../types/message'
import { useOutgoingMessages } from '../hooks/useChat'
import { createConversationKey } from '../utils/conversationKey'
import { createMessageId, serializeRichMessage, parseRichMessage } from '../utils/richMessage'
import { getLeaveRequest, subscribeLeaveRequests } from '../features/rooms/leaveRoomRequestState'

export default function ChatLayout() {
    const dispatch = useAppDispatch()
    const { currentUser, authStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const { connectionStatus, reconnectCount, canUseSocket } = useSocket()
    const [selectedConversation, setSelectedConversation] = useState<ConversationRef | null>(null)

    const [showLogoutDialog, setShowLogoutDialog] = useState(false)
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const { checkHistory } = useOutgoingMessages()
    const histories = useAppSelector(state => state.messages)
    const [sendError, setSendError] = useState('')
    const { getDraft, getRetrySource, updateDraft, hasAnyDraft, hasDraft, clearDraft } = useChatDrafts()
    const conversationKey = selectedConversation ? createConversationKey(selectedConversation) : null
    const roomMembership = useAppSelector(state => selectedConversation?.kind === 'room' && conversationKey
        ? state.rooms.byKey[conversationKey]?.room.membership : undefined)
    const leaveRequest = useSyncExternalStore(subscribeLeaveRequests,
        () => selectedConversation?.kind === 'room'
            ? getLeaveRequest(sessionGeneration, selectedConversation.name) : null,
        () => null)
    const canSend = canUseSocket && !isLoggingOut && (selectedConversation?.kind === 'people'
        || (selectedConversation?.kind === 'room'
            && (roomMembership === 'member' || roomMembership === 'owner')
            && leaveRequest?.status !== 'pending' && leaveRequest?.status !== 'unknown'
            && leaveRequest?.status !== 'success'))

    const receiveMessage = useEffectEvent((conversation: ConversationRef, message: Message) => {
        if (!canUseSocket || isLoggingOut) return
        dispatch(messageReceived({
            conversation, message, viewed: createConversationKey(conversation) === conversationKey,
        }))
    })

    const checkOwnMessage = useEffectEvent((conversation: ConversationRef) => { void checkHistory(conversation) })

    useEffect(() => {
        if (!currentUser || !canUseSocket || isLoggingOut) return
        return subscribeToMessages(
            currentUser,
            (conversation, message) => receiveMessage(conversation, message),
            message => {
                dispatch(outgoingExpired(Date.now()))
                if (message) dispatch(outgoingErrorReceived(message))
                setSendError('Máy chủ báo lỗi gửi. Chỉ tin có phản hồi khớp mới được đánh dấu thất bại.')
            },
            conversation => checkOwnMessage(conversation),
        )
    }, [currentUser, canUseSocket, isLoggingOut, dispatch])

    function selectConversation(conversation: ConversationRef | null) {
        setSendError('')
        if (conversation) dispatch(markViewed(createConversationKey(conversation)))
        setSelectedConversation(conversation)
    }

    async function handleLogout() {
        if (isLoggingOut) return
        setShowLogoutDialog(false)
        setIsLoggingOut(true)

        await endSession()
    }

    function requestLogout() {
        if (hasAnyDraft()) {
            setShowLogoutDialog(true)
            return
        }
        void handleLogout()
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
                <button type="button" disabled={isLoggingOut} onClick={requestLogout}>
                    {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </button>
            </header>
            {showLogoutDialog && (
                <LogoutDialog onCancel={() => setShowLogoutDialog(false)} onConfirm={handleLogout} />
            )}
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
                    headerActions={selectedConversation?.kind === 'room' ? (
                        <RoomMembersPanel
                            key={`${sessionGeneration}:${selectedConversation.name}`}
                            conversation={{ kind: 'room', name: selectedConversation.name }}
                            currentUser={currentUser}
                            sessionGeneration={sessionGeneration}
                            canLoad={canUseSocket}
                            draft={getDraft(selectedConversation).map(run => run.text).join('')}
                            onLeaveConfirmed={conversation => {
                                clearDraft(conversation)
                                setSelectedConversation(previous => previous?.kind === 'room' && previous.name === conversation.name ? null : previous)
                            }}
                        />
                    ) : undefined}
                    draft={selectedConversation ? getDraft(selectedConversation) : []}
                    canSend={canSend}
                    onDraftChange={(conversation, draft) => {
                        setSendError('')
                        updateDraft(conversation, draft)
                    }}
                    onSend={(conversation, draft) => {
                        if (!canSend || !currentUser || createConversationKey(conversation) !== conversationKey) return
                        setSendError('')
                        let outgoing: OutgoingMessage | undefined
                        try {
                            const retrySource = getRetrySource(conversation)
                            const previousContent = retrySource && parseRichMessage(retrySource.mes)
                            const sameContent = previousContent && sameTextRuns(previousContent.runs, draft)
                            const clientMessageId = sameContent ? previousContent.clientMessageId : createMessageId()
                            const encoded = serializeRichMessage({ version: 1, clientMessageId, runs: draft })
                            if (encoded.status !== 'success') {
                                setSendError(encoded.error.message)
                                return
                            }
                            outgoing = {
                                localId: clientMessageId, clientMessageId, name: currentUser,
                                kind: conversation.kind, to: conversation.name, mes: encoded.data,
                                sentAt: Date.now(), status: 'pending',
                                attempts: sameContent ? (retrySource?.attempts ?? 1) + 1 : 1,
                            }
                            dispatch(outgoingQueued({ conversation, message: outgoing }))
                            sendText(conversation, encoded.data)
                            clearDraft(conversation)
                        } catch {
                            if (outgoing) {
                                dispatch(outgoingSendFailed({ conversation, localId: outgoing.localId }))
                                updateDraft(conversation, draft, outgoing)
                            }
                            setSendError('Không gửi được tin nhắn. Bản nháp vẫn được giữ.')
                        }
                    }}
                    pending={conversationKey ? histories[conversationKey]?.outgoing ?? [] : []}
                    reconcileError={conversationKey ? histories[conversationKey]?.reconcileError : undefined}
                    checkingHistory={Boolean(conversationKey && histories[conversationKey]?.reconcileRequestId)}
                    onCheckHistory={() => { if (selectedConversation) void checkHistory(selectedConversation) }}
                    onRestorePending={message => {
                        if (!selectedConversation || hasDraft(selectedConversation)) {
                            setSendError('Đang có bản nháp. Hãy xử lý bản nháp trước khi sửa tin này.')
                            return
                        }
                        const content = parseRichMessage(message.mes)
                        if (content) updateDraft(selectedConversation, content.runs, message)
                    }}
                    sendError={sendError}
                    onBack={() => selectConversation(null)}
                />
            </div>
        </main>
    )
}
