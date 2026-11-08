import type {
    ConversationKey,
    ConversationRef,
} from '../types/api'

export function createConversationKey(
    conversation: ConversationRef,
): ConversationKey {
    return JSON.stringify([
        conversation.kind,
        conversation.name,
    ])
}