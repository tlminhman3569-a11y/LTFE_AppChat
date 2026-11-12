import ConversationList from '../../components/ConversationList'
import type { ConversationRef } from '../../types/api'
import type { OnSelectConversation, RecentConversation } from '../../types/user'
import { filterRecentConversations } from '../../utils/filterRecentConversations'

interface Props {
    conversations: RecentConversation[]
    query: string
    loading?: boolean
    error?: string | null
    onRetry?: () => void
    selectedConversation?: ConversationRef | null
    onSelectConversation: OnSelectConversation
}

export default function UserSearch({
                                       conversations, query, loading = false, error = null,
                                       onRetry, selectedConversation, onSelectConversation,
                                   }: Props) {
    if (loading) return <p role="status">Đang tải người dùng...</p>

    if (error) {
        return (
            <div role="alert" className="cv39-notice">
                <p>{error}</p>
                {onRetry && <button type="button" onClick={onRetry}>Thử lại</button>}
            </div>
        )
    }

    const matches = filterRecentConversations(conversations, query, 'people')

    if (matches.length === 0) {
        return <p className="cv39-empty">Không có người dùng phù hợp trong dữ liệu gần đây. Người dùng vẫn có thể tồn tại trên hệ thống.</p>
    }

    return (
        <ConversationList
            conversations={matches}
            selectedConversation={selectedConversation}
            onSelectConversation={onSelectConversation}
        />
    )
}
