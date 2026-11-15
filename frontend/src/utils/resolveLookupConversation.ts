import type { ConversationRef } from '../types/api'
import type { RecentConversation } from '../types/user'

export function resolveLookupConversation(name: string, conversations: readonly RecentConversation[]): ConversationRef {
    const matchedUser = conversations.find(item =>
        item.kind === 'people' && item.name.toLowerCase() === name.toLowerCase()
    )
    return { kind: 'people', name: matchedUser?.name ?? name }
}
