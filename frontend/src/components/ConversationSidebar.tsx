import { useEffect, useState } from 'react'
import { conversationsEmpty, conversationsError, conversationsUnknown } from '../fixtures/conversations'
import { getRecentConversations } from '../fixtures/mockServices'
import RoomSearch from '../features/rooms/RoomSearch'
import UserSearch from '../features/users/UserSearch'
import CheckUser from '../features/users/CheckUser'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { refreshConversations } from '../store/slices/conversationsSlice'
import { refreshPresence } from '../store/slices/presenceSlice'
import type { ApiResult, ConversationKind, ConversationRef } from '../types/api'
import type { OnSelectConversation, RecentConversation } from '../types/user'
import { filterRecentConversations } from '../utils/filterRecentConversations'
import { applyConversationLoad } from '../utils/conversationLoadState'
import type { ConversationLoadState } from '../utils/conversationLoadState'
import ConversationList from './ConversationList'
import './ConversationSidebar.css'

type SuggestionFilter = 'all' | ConversationKind
type MockMode = 'api' | 'success' | 'empty' | 'error' | 'unknown'

interface Props {
    selectedConversation: ConversationRef | null
    onSelectConversation: OnSelectConversation
    onMockModeChange?: (usingMock: boolean) => void
}

export default function ConversationSidebar({ selectedConversation, onSelectConversation, onMockModeChange }: Props) {
    const dispatch = useAppDispatch()
    const { authStatus, connectionStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const apiList = useAppSelector(state => state.conversations)
    const [query, setQuery] = useState('')
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
    const conversations = isMock ? mockListState.conversations : apiList.items
    const loading = isMock ? mockLoading : apiList.loading
    const loaded = isMock ? mockLoaded : apiList.loaded
    const disconnected = !isMock && authStatus === 'authenticated'
        && (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting')
    const error = isMock
        ? mockListState.error
        : apiList.error || (disconnected ? 'Kết nối bị gián đoạn. Chưa thể cập nhật danh sách.' : '')
    const suggestions = filterRecentConversations(conversations, query)

    function selectConversation(conversation: ConversationRef) {
        onSelectConversation(conversation)
        if (!isMock && conversation.kind === 'people') {
            void dispatch(refreshPresence({ user: conversation.name, sessionGeneration }))
        }
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
        onMockModeChange?.(mode !== 'api')
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
            {!isMock && (filter === 'people' || conversations.length === 0) && (
                <CheckUser
                    key={JSON.stringify([sessionGeneration, query])}
                    username={query}
                    onSelectConversation={selectConversation}
                />
            )}

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
                                <UserSearch conversations={conversations} query={query} selectedConversation={selectedConversation} onSelectConversation={selectConversation} />
                            ) : filter === 'room' ? (
                                <RoomSearch conversations={conversations} query={query} selectedConversation={selectedConversation} onSelectConversation={selectConversation} />
                            ) : suggestions.length > 0 ? (
                                <ConversationList conversations={suggestions} selectedConversation={selectedConversation} onSelectConversation={selectConversation} />
                            ) : (
                                <p className="cv39-empty">Không có gợi ý phù hợp trong dữ liệu gần đây. Không thể kết luận người hoặc phòng không tồn tại.</p>
                            )}
                        </section>

                        <section className="cv39-section" aria-label="Tất cả hội thoại">
                            <div className="cv39-section-heading">
                                <h3>Tất cả hội thoại</h3>
                                <span>{conversations.length} mục</span>
                            </div>
                            <ConversationList conversations={conversations} selectedConversation={selectedConversation} onSelectConversation={selectConversation} />
                        </section>
                    </>
                )}
            </div>
        </aside>
    )
}
