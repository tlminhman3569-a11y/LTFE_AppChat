import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { refreshRoomMembers, roomLeft, roomLeaveUncertain } from '../../store/slices/roomsSlice'
import { leaveRoom } from '../../services/roomsApi'
import type { ConversationRef } from '../../types/api'
import LeaveRoom from './LeaveRoom'
import { createConversationKey } from '../../utils/conversationKey'
import type { RoomConversationRef } from '../../types/room'
import MemberList from './MemberList'

type Props = { conversation: RoomConversationRef; currentUser: string | null; sessionGeneration: number; canLoad: boolean; draft: string; onLeaveConfirmed: (conversation: ConversationRef) => void }

export default function RoomMembersPanel({ conversation, currentUser, sessionGeneration, canLoad, draft, onLeaveConfirmed }: Props) {
    const dispatch = useAppDispatch()
    const [open, setOpen] = useState(false)
    const [showLeave, setShowLeave] = useState(false)
    const entry = useAppSelector(state => state.rooms.byKey[createConversationKey(conversation)])
    const historyLoading = useAppSelector(state => Boolean(state.messages[createConversationKey(conversation)]?.requestId))
    const room = entry?.room ?? { name: conversation.name, ownerKnown: false, membersKnown: false, membership: 'unknown' as const }
    const loading = Boolean(entry?.loading || (historyLoading && !entry?.loadedAt))
    const error = entry?.error ?? null
    const loadedAt = entry?.loadedAt ? new Date(entry.loadedAt).toLocaleString('vi-VN') : undefined

    function refresh() {
        if (canLoad) void dispatch(refreshRoomMembers({ name: conversation.name, sessionGeneration }))
    }

    function show() {
        setOpen(true)
        if (!entry?.loadedAt && !loading) refresh()
    }

    return (
        <>
            <button type="button" onClick={show}>Thành viên</button>
            {open && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#0f172a77', display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto' }}>
                    <div role="dialog" aria-modal="true" aria-label={`Danh sách thành viên phòng ${conversation.name}`} style={{ width: 'min(100%, 360px)' }}>
                        <MemberList
                            room={room}
                            currentUser={currentUser}
                            loading={loading}
                            error={error ?? (!canLoad ? { kind: 'connection', message: 'Cần kết nối để tải thành viên phòng.' } : null)}
                            onRefresh={refresh}
                            onClose={() => setOpen(false)}
                            loadedAt={loadedAt}
                            onRequestLeave={() => setShowLeave(true)}
                        />
                    </div>
                </div>
            )}
            {showLeave && (
                <LeaveRoom
                    room={room}
                    currentUser={currentUser}
                    hasDraft={Boolean(draft.trim())}
                    draftPreview={draft.trim().slice(0, 120)}
                    onClose={() => setShowLeave(false)}
                    leaveRoom={leaveRoom}
                    onStatusChange={(_, status) => {
                        if (status === 'unknown') dispatch(roomLeaveUncertain({ name: conversation.name, sessionGeneration }))
                    }}
                    onLeaveConfirmed={() => {
                        dispatch(roomLeft({ name: conversation.name, sessionGeneration }))
                        onLeaveConfirmed(conversation)
                        setShowLeave(false)
                        setOpen(false)
                    }}
                />
            )}
        </>
    )
}
