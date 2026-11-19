import { useState } from 'react'
import type { ConversationKey, ConversationRef } from '../../types/api'
import type { TextRun, OutgoingMessage } from '../../types/message'
import { createConversationKey } from '../../utils/conversationKey'

interface Draft {
    runs: TextRun[]
    retrySource?: OutgoingMessage
}

export function useChatDrafts() {
    const [drafts, setDrafts] = useState<Partial<Record<ConversationKey, Draft>>>({})

    function getDraft(conversation: ConversationRef) {
        return drafts[createConversationKey(conversation)]?.runs ?? []
    }

    function updateDraft(conversation: ConversationRef, draft: TextRun[], retrySource?: OutgoingMessage) {
        const key = createConversationKey(conversation)
        setDrafts(previous => {
            if (draft.length > 0) return {
                ...previous,
                [key]: { runs: draft, retrySource: retrySource ?? previous[key]?.retrySource },
            }
            const next = { ...previous }
            delete next[key]
            return next
        })
    }

    return {
        getDraft,
        getRetrySource: (conversation: ConversationRef) => drafts[createConversationKey(conversation)]?.retrySource,
        updateDraft,
        hasAnyDraft: () => Object.values(drafts).some(draft => draft?.runs.some(run => run.text.trim())),
        hasDraft: (conversation: ConversationRef) => getDraft(conversation).some(run => run.text.trim()),
        clearDraft: (conversation: ConversationRef) => updateDraft(conversation, []),
    }
}
