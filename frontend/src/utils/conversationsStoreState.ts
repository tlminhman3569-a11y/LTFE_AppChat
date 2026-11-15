import type { ApiResult, ConversationRef } from '../types/api.ts'
import type { RecentConversation } from '../types/user.ts'

export interface ConversationsState {
    items: RecentConversation[]
    verified: ConversationRef[]
    loading: boolean
    loaded: boolean
    error: string | null
    sessionGeneration: number | null
    requestId: string | null
}

export function emptyConversationsState(): ConversationsState {
    return {
        items: [],
        verified: [],
        loading: false,
        loaded: false,
        error: null,
        sessionGeneration: null,
        requestId: null,
    }
}

export function startConversationsLoad(
    previous: ConversationsState,
    sessionGeneration: number,
    requestId: string,
): ConversationsState {
    return {
        ...previous,
        loading: true,
        error: null,
        sessionGeneration,
        requestId,
    }
}

export function finishConversationsLoad(
    previous: ConversationsState,
    sessionGeneration: number,
    requestId: string,
    result: ApiResult<RecentConversation[]>,
): ConversationsState {
    if (previous.sessionGeneration !== sessionGeneration || previous.requestId !== requestId) {
        return previous
    }

    if (result.status === 'success') {
        return {
            ...previous,
            items: [...previous.verified, ...result.data.filter(item =>
                !previous.verified.some(user => user.kind === item.kind && user.name === item.name))],
            loaded: true,
            loading: false,
            error: null,
            requestId: null,
        }
    }

    return {
        ...previous,
        loading: false,
        error: result.error.message,
        requestId: null,
    }
}
