import { uploadImage } from '../../services/uploadApi'
import type { ConversationRef } from '../../types/api'
import type { UploadResult } from '../../types/media'

export type UploadTaskResult = UploadResult & {
    conversation: ConversationRef
    sessionGeneration: number
}

export function createUploadTask() {
    let active: AbortController | null = null

    function cancel() {
        const controller = active
        active = null
        controller?.abort()
    }

    async function start(file: File, conversation: ConversationRef, sessionGeneration: number): Promise<UploadTaskResult | null> {
        cancel()
        const controller = new AbortController()
        const target = { kind: conversation.kind, name: conversation.name }
        active = controller

        try {
            const res = await uploadImage(file, controller.signal)
            if (active !== controller || controller.signal.aborted) return null

            return { ...res, conversation: target, sessionGeneration }
        } catch (err) {
            if (active !== controller || controller.signal.aborted) return null
            throw err
        } finally {
            // Lượt cũ xong sau không được dọn controller của lượt mới
            if (active === controller) active = null
        }
    }

    return { start, cancel }
}
