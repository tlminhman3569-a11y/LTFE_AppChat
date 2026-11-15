import type {
    ConversationKey,
    ConversationRef,
} from '../types/api.ts'

export function createConversationKey(
    conversation: ConversationRef,
): ConversationKey {
    return JSON.stringify([
        conversation.kind,
        conversation.name,
    ])
}