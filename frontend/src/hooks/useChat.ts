import { useEffect, useEffectEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchHistoryPage, reconcileOutgoing, outgoingExpired } from '../store/slices/messagesSlice'
import type { ConversationRef } from '../types/api'
import type { Message } from '../types/message'
import { createConversationKey } from '../utils/conversationKey'

const noMessages: Message[] = []

export function useChat({ kind, name }: ConversationRef) {
    const dispatch = useAppDispatch()
    const history = useAppSelector(state => state.messages[createConversationKey({ kind, name })])
    const { authStatus, connectionStatus, sessionGeneration } = useAppSelector(state => state.auth)
    const canLoad = authStatus === 'authenticated' && connectionStatus === 'connected'
    const shouldLoadFirstPage = !history || (history.nextPage === 1 && history.hasOlder && !history.error && !history.requestId)

    useEffect(() => {
        if (!canLoad || !shouldLoadFirstPage) return
        void dispatch(fetchHistoryPage({ conversation: { kind, name }, page: 1, sessionGeneration }))
    }, [canLoad, dispatch, kind, name, sessionGeneration, shouldLoadFirstPage])

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
        loading: Boolean(history?.requestId) || (canLoad && shouldLoadFirstPage),
        error: history?.error ?? '',
        canLoad,
        loadNextPage,
    }
}

export function useOutgoingMessages() {
    const dispatch = useAppDispatch()
    const histories = useAppSelector(state => state.messages)
    const { authStatus, connectionStatus, sessionGeneration, reconnectCount } = useAppSelector(state => state.auth)
    const canCheck = authStatus === 'authenticated' && connectionStatus === 'connected'
    const signature = Object.values(histories).flatMap(history => history?.outgoing?.map(message => message.localId + ':' + message.status) ?? []).join('|')
    const hasPending = Object.values(histories).some(history => history?.outgoing?.some(message => message.status === 'pending'))

    useEffect(() => {
        if (!hasPending) return
        if (!canCheck) {
            dispatch(outgoingExpired(Date.now()))
            return
        }
        const timer = setInterval(() => dispatch(outgoingExpired(Date.now() - 10000)), 1000)
        return () => clearInterval(timer)
    }, [canCheck, dispatch, hasPending])

    const checkAllPending = useEffectEvent(() => {
        for (const history of Object.values(histories)) {
            const message = history?.outgoing?.[0]
            if (!message) continue
            const conversation = { kind: message.kind, name: message.to }
            void dispatch(reconcileOutgoing({ conversation, sessionGeneration }))
        }
    })

    useEffect(() => {
        if (!canCheck || !signature) return
        const timer = setTimeout(() => checkAllPending(), 500)
        return () => clearTimeout(timer)
    }, [canCheck, sessionGeneration, reconnectCount, signature])

    function checkHistory(conversation: ConversationRef) {
        return dispatch(reconcileOutgoing({ conversation, sessionGeneration }))
    }

    return { checkHistory }
}