import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { refreshRoomMembers } from '../../store/slices/roomsSlice'
import { createConversationKey } from '../../utils/conversationKey'
import type { RoomConversationRef } from '../../types/room'
import MemberList from './MemberList'

type Props = { conversation: RoomConversationRef; currentUser: string | null; sessionGeneration: number; canLoad: boolean }

export default function RoomMembersPanel({ conversation, currentUser, sessionGeneration, canLoad }: Props) {
    const dispatch = useAppDispatch()
    const [open, setOpen] = useState(false)
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
                        />
                    </div>
                </div>
            )}
        </>
    )
}
