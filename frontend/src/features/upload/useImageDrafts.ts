import { useEffect, useRef, useState } from 'react'
import { store } from '../../store'
import { uploadImage } from '../../services/uploadApi'
import { sendText } from '../../services/chatApi'
import type { ConversationKey, ConversationRef } from '../../types/api'
import type { UploadedImage } from '../../types/media'
import { imageMimeTypes, maxImageBytes } from '../../types/media'
import { createConversationKey } from '../../utils/conversationKey'
import { createMessageId } from '../../utils/richMessage'
import { serializeImageMessage } from '../../utils/imageMessage'
import { getLeaveRequest } from '../rooms/leaveRoomRequestState'

interface ImageDraft {
    file?: File
    previewUrl?: string
    clientMessageId?: string
    uploaded?: UploadedImage
    controller?: AbortController
    uploading?: boolean
    notice?: string
    error?: string
    sessionGeneration: number
}

export function canSendImage(conversation: ConversationRef, sessionGeneration: number): boolean {
    const { auth, rooms } = store.getState()
    if (auth.authStatus !== 'authenticated' || auth.connectionStatus !== 'connected'
        || auth.sessionGeneration !== sessionGeneration) return false
    if (conversation.kind === 'people') return true
    const room = rooms.byKey[createConversationKey(conversation)]
    const leaving = getLeaveRequest(sessionGeneration, conversation.name)
    return (room?.room.membership === 'member' || room?.room.membership === 'owner')
        && !room.leaveRejected && leaving?.status !== 'pending'
        && leaving?.status !== 'unknown' && leaving?.status !== 'success'
}

export function useImageDrafts(sessionGeneration: number) {
    const entries = useRef<Partial<Record<ConversationKey, ImageDraft>>>({})
    const [drafts, setDrafts] = useState<Partial<Record<ConversationKey, ImageDraft>>>({})

    function save(key: ConversationKey, draft: ImageDraft) {
        entries.current = { ...entries.current, [key]: draft }
        setDrafts(entries.current)
    }

    function remove(conversation: ConversationRef) {
        const key = createConversationKey(conversation)
        const draft = entries.current[key]
        draft?.controller?.abort()
        if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl)
        save(key, { sessionGeneration })
    }

    useEffect(() => () => {
        for (const draft of Object.values(entries.current)) {
            draft?.controller?.abort()
            if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl)
        }
        entries.current = {}
    }, [sessionGeneration])

    function select(conversation: ConversationRef, file: File) {
        if (!canSendImage(conversation, sessionGeneration)) return
        const key = createConversationKey(conversation)
        const previous = entries.current[key]
        let error = ''
        if (!imageMimeTypes.some(mime => mime === file.type)) error = 'Chỉ chọn ảnh JPEG, PNG hoặc WebP.'
        else if (!file.size || file.size > maxImageBytes) error = 'Chọn ảnh lớn hơn 0 và không quá 5 MiB.'
        if (error) {
            save(key, { ...previous, sessionGeneration, error })
            return
        }
        try {
            const clientMessageId = createMessageId()
            const previewUrl = URL.createObjectURL(file)
            remove(conversation)
            save(key, { file, previewUrl, clientMessageId, sessionGeneration })
        } catch {
            save(key, { ...previous, sessionGeneration, error: 'Không mở được ảnh. Hãy chọn lại.' })
        }
    }

    async function send(conversation: ConversationRef) {
        const key = createConversationKey(conversation)
        const draft = entries.current[key]
        if (!draft?.file || draft.uploading || !canSendImage(conversation, sessionGeneration)) return
        const controller = new AbortController()
        const task = { ...draft, controller, uploading: true, error: '', notice: '' }
        save(key, task)
        try {
            const result = task.uploaded ? { status: 'success' as const, data: task.uploaded }
                : await uploadImage(task.file!, controller.signal)
            // Bỏ kết quả của ảnh đã bỏ/thay hoặc tài khoản đã đổi; không đổi đích sang chat đang mở.
            if (entries.current[key] !== task || controller.signal.aborted) return
            if (result.status !== 'success') {
                save(key, { ...task, uploading: false, error: result.error.message })
                return
            }
            task.uploaded = result.data
            if (!canSendImage(conversation, sessionGeneration)) {
                save(key, { ...task, uploading: false, error: 'Chưa thể gửi: kiểm tra kết nối, phiên và quyền hội thoại. Ảnh nháp vẫn được giữ.' })
                return
            }
            const encoded = serializeImageMessage({ version: 1, type: 'image',
                clientMessageId: task.clientMessageId!, image: result.data })
            if (encoded.status !== 'success') {
                save(key, { ...task, uploading: false, error: encoded.error.message })
                return
            }
            sendText(conversation, encoded.data)
            remove(conversation)
            save(key, { sessionGeneration, notice: 'Đã gửi yêu cầu gửi ảnh. Chưa xác nhận lưu trên máy chủ.' })
        } catch {
            if (entries.current[key] === task) save(key, { ...task, uploading: false,
                error: 'Không gửi được ảnh. Ảnh nháp vẫn được giữ; không tự gửi lại.' })
        }
    }

    return {
        get: (conversation: ConversationRef) => {
            const draft = drafts[createConversationKey(conversation)]
            return draft?.sessionGeneration === sessionGeneration ? draft : undefined
        },
        hasAny: () => Object.values(drafts).some(draft => draft?.sessionGeneration === sessionGeneration && draft.file),
        cancelUploads: () => {
            for (const [key, draft] of Object.entries(entries.current)) {
                if (!draft?.uploading) continue
                draft.controller?.abort()
                save(key as ConversationKey, { ...draft, uploading: false, error: 'Đã dừng upload. Ảnh nháp vẫn được giữ.' })
            }
        },
        select, remove, send,
    }
}
