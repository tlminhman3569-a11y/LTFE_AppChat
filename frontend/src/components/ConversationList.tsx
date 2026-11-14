import { useAppSelector } from '../store/hooks'
import type { ConversationRef } from '../types/api'
import type { OnSelectConversation, RecentConversation } from '../types/user'
import { createConversationKey } from '../utils/conversationKey'

interface Props {
    conversations: RecentConversation[]
    selectedConversation?: ConversationRef | null
    onSelectConversation: OnSelectConversation
}

export default function ConversationList({ conversations, selectedConversation, onSelectConversation }: Props) {
    const history = useAppSelector(state => state.messages)
    const selectedKey = selectedConversation ? createConversationKey(selectedConversation) : null

    return (
        <ul className="cv39-list">
            {conversations.map(conversation => {
                const key = createConversationKey(conversation)
                const unread = history[key]?.unread ?? 0
                const isRoom = conversation.kind === 'room'

                return (
                    <li key={key}>
                        <button
                            type="button"
                            className="cv39-item"
                            aria-current={selectedKey === key ? 'true' : undefined}
                            aria-label={`${isRoom ? 'Mở phòng' : 'Mở chat riêng'} ${conversation.name}`}
                            onClick={() => onSelectConversation({ kind: conversation.kind, name: conversation.name })}
                        >
                            <span className="cv39-avatar" aria-hidden="true">
                                {isRoom ? '#' : conversation.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="cv39-item-info">
                                <strong>{conversation.name}</strong>
                                <span>{isRoom ? 'Phòng chat' : 'Người dùng'}</span>
                                {unread > 0 && <small>{unread} chưa xem</small>}
                                {conversation.actionTime && <small>Hoạt động: {conversation.actionTime}</small>}
                            </span>
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}
