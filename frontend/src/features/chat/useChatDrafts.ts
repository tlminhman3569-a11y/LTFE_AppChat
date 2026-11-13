import { useState } from 'react'
import type { ConversationKey, ConversationRef } from '../../types/api'
import type { TextRun } from '../../types/message'
import { createConversationKey } from '../../utils/conversationKey'

export function useChatDrafts() {
    const [drafts, setDrafts] = useState<Partial<Record<ConversationKey, TextRun[]>>>({})

    function getDraft(conversation: ConversationRef) {
        return drafts[createConversationKey(conversation)] ?? []
    }

    function updateDraft(conversation: ConversationRef, draft: TextRun[]) {
        const key = createConversationKey(conversation)
        setDrafts(previous => {
            if (draft.length > 0) return { ...previous, [key]: draft }
            const next = { ...previous }
            delete next[key]
            return next
        })
    }

    return {
        getDraft,
        updateDraft,
        hasAnyDraft: () => Object.values(drafts).some(draft => draft?.some(run => run.text.trim())),
        hasDraft: (conversation: ConversationRef) => getDraft(conversation).some(run => run.text.trim()),
        clearDraft: (conversation: ConversationRef) => updateDraft(conversation, []),
    }
}
