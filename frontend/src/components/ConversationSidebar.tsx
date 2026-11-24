import { useEffect, useState } from 'react'
import { conversationsEmpty, conversationsError, conversationsUnknown } from '../fixtures/conversations'
import { getRecentConversations } from '../fixtures/mockServices'
import RoomSearch from '../features/rooms/RoomSearch'
import CreateRoom from '../features/rooms/CreateRoom'
import JoinRoom from '../features/rooms/JoinRoom'
import { createRoom as createRoomApi, joinRoom as joinRoomApi } from '../services/roomsApi'
import type { Room } from '../types/room'
import UserSearch from '../features/users/UserSearch'
import UserLookup from '../features/users/UserLookup'
import UserPresence from '../features/users/UserPresence'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { conversationsForSidebar, refreshConversations } from '../store/slices/conversationsSlice'
import { roomConfirmed } from '../store/slices/roomsSlice'
import type { ApiResult, ConversationKind, ConversationRef } from '../types/api'
import type { OnSelectConversation, RecentConversation } from '../types/user'
import { filterRecentConversations } from '../utils/filterRecentConversations'
import { createConversationKey } from '../utils/conversationKey'
import { resolveLookupConversation } from '../utils/resolveLookupConversation'
import { applyConversationLoad } from '../utils/conversationLoadState'
import type { ConversationLoadState } from '../utils/conversationLoadState'
import ConversationList from './ConversationList'
import './ConversationSidebar.css'

type SuggestionFilter = 'all' | ConversationKind
type MockMode = 'api' | 'success' | 'empty' | 'error' | 'unknown'

interface Props {
    selectedConversation: ConversationRef | null
    onSelectConversation: OnSelectConversation
}

export default function ConversationSidebar({ selectedConversation, onSelectConversation }: Props) {
    const dispatch = useAppDispatch()
    const { authStatus, connectionStatus, currentUser, sessionGeneration } = useAppSelector(state => state.auth)
    const apiList = useAppSelector(state => state.conversations)
    const roomsByKey = useAppSelector(state => state.rooms.byKey)
    const [query, setQuery] = useState('')
    const [roomDialog, setRoomDialog] = useState<{ action: 'create' | 'join'; sessionGeneration: number; initialName?: string } | null>(null)
    const [roomUpdate, setRoomUpdate] = useState<{ name: string; action: 'create' | 'join'; status: string; sessionGeneration: number } | null>(null)
    const [confirmedRoom, setConfirmedRoom] = useState<{ room: Room; sessionGeneration: number } | null>(null)
    const [confirmedRoomNames, setConfirmedRoomNames] = useState<{ sessionGeneration: number; names: string[] } | null>(null)
    const [filter, setFilter] = useState<SuggestionFilter>('all')
    const [mockMode, setMockMode] = useState<MockMode>('api')
    const [mockListState, setListState] = useState<ConversationLoadState>({ conversations: [], error: '' })
    const [mockLoading, setMockLoading] = useState(false)
    const [mockLoaded, setMockLoaded] = useState(false)
    const [mockAttempt, setMockAttempt] = useState(0)

    useEffect(() => {
        if (mockMode !== 'api' || authStatus !== 'authenticated' || connectionStatus !== 'connected') return
        void dispatch(refreshConversations(sessionGeneration))
    }, [authStatus, connectionStatus, dispatch, mockMode, sessionGeneration])

    useEffect(() => {
        if (mockMode === 'api') return
        let active = true

        const timer = setTimeout(async () => {
            try {
                let result: ApiResult<RecentConversation[]>
                if (mockMode === 'empty') result = conversationsEmpty
                else if (mockMode === 'error') result = conversationsError
                else if (mockMode === 'unknown') result = conversationsUnknown
                else result = await getRecentConversations()

                if (!active) return
                setListState(previous => applyConversationLoad(previous, result))
                if (result.status === 'success') setMockLoaded(true)
            } catch {
                if (!active) return
                setListState(previous => ({ ...previous, error: 'Không tải được danh sách hội thoại gần đây.' }))
            } finally {
                if (active) setMockLoading(false)
            }
        }, 250)

        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [mockAttempt, mockMode])

    const isMock = mockMode !== 'api'
    const confirmedNames = confirmedRoomNames?.sessionGeneration === sessionGeneration ? confirmedRoomNames.names : []
    const conversations = isMock ? mockListState.conversations : conversationsForSidebar([
        ...apiList.items,
        ...confirmedNames.filter(name => !apiList.items.some(item => item.kind === 'room' && item.name === name))
            .map(name => ({ kind: 'room' as const, name })),
    ], roomsByKey)
    const leftRooms = isMock ? [] : Object.values(roomsByKey)
        .filter(entry => entry.room.membership === 'left')
        .map(entry => entry.room.name)
    const loading = isMock ? mockLoading : apiList.loading
    const loaded = isMock ? mockLoaded : apiList.loaded
    const disconnected = !isMock && authStatus === 'authenticated'
        && (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting')
    const error = isMock
        ? mockListState.error
        : apiList.error || (disconnected ? 'Kết nối bị gián đoạn. Chưa thể cập nhật danh sách.' : '')
    const suggestions = filterRecentConversations(conversations, query)
    const activeRoomDialog = roomDialog?.sessionGeneration === sessionGeneration ? roomDialog : null
    const currentRoomUpdate = roomUpdate?.sessionGeneration === sessionGeneration ? roomUpdate : null
    const activeRoomUpdate = currentRoomUpdate?.action === 'join' && currentRoomUpdate.status === 'success'
    && roomsByKey[createConversationKey({ kind: 'room', name: currentRoomUpdate.name })]?.leaveRejected
        ? null : currentRoomUpdate
    const confirmedEntry = confirmedRoom?.sessionGeneration === sessionGeneration
        ? roomsByKey[createConversationKey({ kind: 'room', name: confirmedRoom.room.name })] : undefined
    const activeConfirmedRoom = confirmedRoom?.sessionGeneration === sessionGeneration
    && confirmedEntry?.room.membership !== 'left' && !confirmedEntry?.leaveRejected
        ? confirmedRoom.room : null

    function onRoomConfirmed(room: Room, shouldSelect = true) {
        dispatch(roomConfirmed(room))
        setConfirmedRoom({ room, sessionGeneration })
        if (shouldSelect) {
            setRoomDialog(null)
            onSelectConversation({ kind: 'room', name: room.name })
        }
    }

    function onRoomRequestChange(action: 'create' | 'join', update: { name: string; sessionGeneration: number; status: string }) {
        if (update.sessionGeneration !== sessionGeneration) return
        setRoomUpdate({ name: update.name, action, status: update.status, sessionGeneration })
        if (update.status === 'success' && authStatus === 'authenticated' && connectionStatus === 'connected') {
            setConfirmedRoomNames(previous => ({
                sessionGeneration,
                names: previous?.sessionGeneration === sessionGeneration
                    ? [...new Set([...previous.names, update.name])] : [update.name],
            }))
            void dispatch(refreshConversations(sessionGeneration))
        }
    }
    function selectLookupUser(conversation: ConversationRef) {
        onSelectConversation(resolveLookupConversation(conversation.name, conversations))
    }

    function retry() {
        if (isMock) {
            setMockLoading(true)
            setListState(previous => ({ ...previous, error: '' }))
            if (mockMode === 'error' || mockMode === 'unknown') setMockMode('success')
            else setMockAttempt(value => value + 1)
        } else {
            void dispatch(refreshConversations(sessionGeneration))
        }
    }

    function changeMockMode(mode: MockMode) {
        setMockMode(mode)
        if (mode !== 'api') {
            setMockLoading(true)
            setListState(previous => ({ ...previous, error: '' }))
        }
    }

    return (
        <aside className="chat-sidebar cv39-sidebar" aria-label="Danh sách hội thoại">
            <div className="cv39-heading">
                <h2>Hội thoại</h2>
                <button type="button" onClick={retry} disabled={loading}>Làm mới</button>
            </div>

            {!isMock && authStatus === 'authenticated' && (
                <div className="cv44-actions">
                    <button type="button" disabled={connectionStatus !== 'connected'} onClick={() => setRoomDialog({ action: 'create', sessionGeneration })}>Tạo phòng</button>
                    <button type="button" disabled={connectionStatus !== 'connected'} onClick={() => setRoomDialog({ action: 'join', sessionGeneration })}>Tham gia phòng</button>
                </div>
            )}
            {activeRoomUpdate && !activeRoomDialog && (
                <p className="cv39-hint" role={activeRoomUpdate.status === 'unknown' ? 'alert' : 'status'}>
                    {activeRoomUpdate.status === 'pending' ? 'Yêu cầu đang chờ phản hồi:'
                        : activeRoomUpdate.status === 'unknown' ? 'Chưa rõ máy chủ đã xử lý yêu cầu:'
                            : activeRoomUpdate.status === 'success' ? 'Máy chủ đã xác nhận:' : 'Yêu cầu thất bại:'}
                    {' '}{activeRoomUpdate.action === 'create' ? 'Tạo' : 'Tham gia'} {activeRoomUpdate.name}
                </p>
            )}
            {activeConfirmedRoom && !activeRoomDialog && (
                <p className="cv39-hint" role="status">
                    {activeConfirmedRoom.name}: {activeConfirmedRoom.membership === 'owner' ? 'Đã xác nhận tạo phòng (chủ phòng)' : 'Đã xác nhận tham gia phòng'}
                </p>
            )}

            <label className="cv39-search-label" htmlFor="cv39-search">Tìm theo tên</label>
            <input
                id="cv39-search"
                className="cv39-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Nhập một phần tên..."
                autoComplete="off"
            />
            <p className="cv39-hint">Chỉ tìm trong hội thoại gần đây, không tìm trên toàn hệ thống.</p>
            <p className="cv39-hint">Nguồn: {isMock ? 'Dữ liệu mẫu CV38' : 'GET_USER_LIST từ máy chủ'}</p>

            {import.meta.env.DEV && (
                <label className="cv39-demo-label">
                    Thử trạng thái mock
                    <select value={mockMode} onChange={event => changeMockMode(event.target.value as MockMode)}>
                        <option value="api">API thật</option>
                        <option value="success">Có dữ liệu</option>
                        <option value="empty">Danh sách trống</option>
                        <option value="error">Lỗi tải</option>
                        <option value="unknown">Chưa xác định</option>
                    </select>
                </label>
            )}

            {!isMock && <UserLookup
                currentUser={currentUser}
                authStatus={authStatus}
                connectionStatus={connectionStatus}
                sessionGeneration={sessionGeneration}
                onSelectConversation={selectLookupUser}
            />}
            {!isMock && selectedConversation?.kind === 'people' && (
                <UserPresence
                    key={`${sessionGeneration}:${connectionStatus}:${selectedConversation.name}`}
                    username={selectedConversation.name}
                    authStatus={authStatus}
                    connectionStatus={connectionStatus}
                    sessionGeneration={sessionGeneration}
                />
            )}

            {leftRooms.length > 0 && (
                <section className="cv39-section" aria-label="Phòng đã rời">
                    <h3>Phòng đã rời</h3>
                    <p className="cv39-hint">Chỉ bấm Tham gia lại mới gửi JOIN_ROOM. Danh sách này chỉ ghi nhận các phòng đã rời trong phiên hiện tại.</p>
                    <ul className="cv39-list">
                        {leftRooms.map(name => (
                            <li key={createConversationKey({ kind: 'room', name })}>
                                <button type="button" className="cv39-item" disabled={connectionStatus !== 'connected'}
                                        onClick={() => setRoomDialog({ action: 'join', sessionGeneration, initialName: name })}>
                                    <span className="cv39-avatar" aria-hidden="true">#</span>
                                    <span className="cv39-item-info"><strong>{name}</strong><span>Đã rời · Tham gia lại</span></span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <div className="cv39-results" aria-busy={loading}>
                {loading && (
                    <p role="status" className="cv39-notice">
                        {conversations.length > 0 ? 'Đang làm mới danh sách hội thoại...' : 'Đang tải danh sách hội thoại...'}
                    </p>
                )}

                {!loading && error && (
                    <div className={`cv39-notice${conversations.length > 0 ? ' cv39-stale-warning' : ''}`} role="alert">
                        {conversations.length > 0 && <p>Không thể làm mới danh sách. Dữ liệu đang hiển thị có thể đã cũ.</p>}
                        <p>{error}</p>
                        <button type="button" onClick={retry}>Thử lại</button>
                    </div>
                )}

                {!isMock && !loading && apiList.loaded && apiList.warning && (
                    <p role="alert" className="cv39-notice cv39-stale-warning">{apiList.warning}</p>
                )}

                {!loading && !error && !loaded && (
                    <p role="status" className="cv39-hint">Chưa tải danh sách. Hãy đợi kết nối hoặc nhấn Làm mới.</p>
                )}

                {!loading && !error && loaded && conversations.length === 0 && (
                    <p role="status" className="cv39-empty">
                        Chưa có hội thoại gần đây. Điều này không có nghĩa người dùng hoặc phòng không tồn tại.
                    </p>
                )}

                {conversations.length > 0 && (
                    <>
                        <section className="cv39-section" aria-label="Gợi ý gần đây">
                            <h3>Gợi ý tìm kiếm</h3>
                            <div className="cv39-filters" role="group" aria-label="Lọc gợi ý">
                                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tất cả</button>
                                <button type="button" aria-pressed={filter === 'people'} onClick={() => setFilter('people')}>Người dùng</button>
                                <button type="button" aria-pressed={filter === 'room'} onClick={() => setFilter('room')}>Phòng</button>
                            </div>
                            {!query.trim() ? (
                                <p className="cv39-hint">Nhập tên để xem gợi ý từ dữ liệu gần đây.</p>
                            ) : filter === 'people' ? (
                                <UserSearch conversations={conversations} query={query} selectedConversation={selectedConversation} onSelectConversation={onSelectConversation} />
                            ) : filter === 'room' ? (
                                <RoomSearch conversations={conversations} query={query} selectedConversation={selectedConversation} onSelectConversation={onSelectConversation} />
                            ) : suggestions.length > 0 ? (
                                <ConversationList conversations={suggestions} selectedConversation={selectedConversation} onSelectConversation={onSelectConversation} />
                            ) : (
                                <p className="cv39-empty">Không có gợi ý phù hợp trong dữ liệu gần đây. Không thể kết luận người hoặc phòng không tồn tại.</p>
                            )}
                        </section>

                        <section className="cv39-section" aria-label="Tất cả hội thoại">
                            <div className="cv39-section-heading">
                                <h3>Tất cả hội thoại</h3>
                                <span>{conversations.length} mục</span>
                            </div>
                            <ConversationList conversations={conversations} selectedConversation={selectedConversation} onSelectConversation={onSelectConversation} />
                        </section>
                    </>
                )}
            </div>
            {activeRoomDialog?.action === 'create' && (
                <CreateRoom
                    createRoom={createRoomApi}
                    initialName={query.trim()}
                    onClose={() => setRoomDialog(null)}
                    onCreated={onRoomConfirmed}
                    onRequestChange={update => onRoomRequestChange('create', update)}
                />
            )}
            {activeRoomDialog?.action === 'join' && (
                <JoinRoom
                    joinRoom={joinRoomApi}
                    initialName={activeRoomDialog.initialName ?? query.trim()}
                    onClose={() => setRoomDialog(null)}
                    onJoined={onRoomConfirmed}
                    onRequestChange={update => onRoomRequestChange('join', update)}
                />
            )}
        </aside>
    )
}
