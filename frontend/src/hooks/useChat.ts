import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchHistoryPage } from '../store/slices/messagesSlice'
import type { ConversationRef } from '../types/api'
import type { Message } from '../types/message'
import { createConversationKey } from '../utils/conversationKey'

const noMessages: Message[] = []

export function useChat({ kind, name }: ConversationRef) {
    const dispatch = useAppDispatch()
    const history = useAppSelector(state => state.messages[createConversationKey({ kind, name })])
    const { authStatus, connectionStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const canLoad = authStatus === 'authenticated' && connectionStatus === 'connected'
    const hasHistory = history !== undefined

    useEffect(() => {
        if (!canLoad || hasHistory) return
        void dispatch(fetchHistoryPage({ conversation: { kind, name }, page: 1, sessionGeneration }))
    }, [canLoad, dispatch, hasHistory, kind, name, sessionGeneration])

    function loadNextPage() {
        if (!canLoad) return
        void dispatch(fetchHistoryPage({
            conversation: { kind, name },
            page: history?.nextPage ?? 1,
            sessionGeneration,
        }))
    }

    return {
        messages: history?.messages ?? noMessages,
        hasOlder: history?.hasOlder ?? true,
        firstPage: (history?.nextPage ?? 1) === 1,
        loading: Boolean(history?.requestId) || (canLoad && !hasHistory),
        error: history?.error ?? '',
        canLoad,
        loadNextPage,
    }
}
