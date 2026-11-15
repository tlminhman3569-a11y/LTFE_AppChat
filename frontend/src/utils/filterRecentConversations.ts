import type { ConversationKind } from '../types/api.ts'
import type { RecentConversation } from '../types/user.ts'

export function filterRecentConversations(
    conversations: RecentConversation[],
    query: string,
    kind?: ConversationKind,
): RecentConversation[] {
    const keyword = query.trim().toLowerCase()

    return conversations.filter(item =>
        (kind === undefined || item.kind === kind) &&
        item.name.toLowerCase().includes(keyword)
    )
}
