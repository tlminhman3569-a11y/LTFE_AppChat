import type { ApiResult } from '../types/api.ts'
import type { RecentConversation } from '../types/user.ts'

export interface ConversationLoadState {
    conversations: RecentConversation[]
    error: string
}

export function applyConversationLoad(
    previous: ConversationLoadState,
    result: ApiResult<RecentConversation[]>,
): ConversationLoadState {
    if (result.status === 'success') {
        return { conversations: result.data, error: '' }
    }

    return { conversations: previous.conversations, error: result.error.message }
}
