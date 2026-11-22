import type { RecentConversationsResult } from './normalizeRecentConversations'
import type { RecentConversation } from '../types/user'

export interface ConversationsState {
    items: RecentConversation[]
    loading: boolean
    loaded: boolean
    error: string | null
    warning: string | null
    sessionGeneration: number | null
    requestId: string | null
}

export function emptyConversationsState(): ConversationsState {
    return {
        items: [],
        loading: false,
        loaded: false,
        error: null,
        warning: null,
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
    result: RecentConversationsResult,
): ConversationsState {
    if (previous.sessionGeneration !== sessionGeneration || previous.requestId !== requestId) {
        return previous
    }

    if (result.status === 'success') {
        return {
            ...previous,
            items: result.data,
            loaded: true,
            loading: false,
            error: null,
            warning: result.warning ?? null,
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
