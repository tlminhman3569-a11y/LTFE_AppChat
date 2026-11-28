import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { store } from '../../store'
import type { ConversationRef } from '../../types/api'
import type { UploadedImage } from '../../types/media'
import { createSessionUploadTask } from './sessionUploadTask'

type UploadStatus = 'idle' | 'uploading' | 'ready' | 'success' | 'error' | 'send-error'
type CanSend = (conversation: ConversationRef) => boolean
type OnUploaded = (image: UploadedImage, conversation: ConversationRef) => void

interface Options {
    file: File | null
    conversation: ConversationRef | null
    canSendNow: CanSend
}

export function useImageUpload({ file, conversation, canSendNow }: Options) {
    const sessionGeneration = useAppSelector(state => state.auth.sessionGeneration)
    const kind = conversation?.kind
    const name = conversation?.name
    const scope = useMemo(() => ({ key: {}, file, kind, name, sessionGeneration }), [file, kind, name, sessionGeneration])
    const [state, setState] = useState<{ scope: object | null; status: UploadStatus; error: string }>({
        scope: null, status: 'idle', error: '',
    })
    const permission = useRef(canSendNow)
    const current = useRef<{
        scope: typeof scope
        task: ReturnType<typeof createSessionUploadTask>
        request: object | null
        image: UploadedImage | null
        done: boolean
    } | null>(null)

    useLayoutEffect(() => { permission.current = canSendNow }, [canSendNow])

    useLayoutEffect(() => {
        const context = { scope, task: createSessionUploadTask(), request: null, image: null, done: false }
        current.current = context
        return () => {
            context.request = null
            context.task.dispose()
            if (current.current === context) current.current = null
        }
    }, [scope])

    function cancel() {
        const context = current.current
        if (!context || context.scope !== scope) return
        context.request = null
        context.image = null
        context.done = false
        context.task.cancel()
        setState({ scope: scope.key, status: 'idle', error: '' })
    }

    async function upload(onUploaded: OnUploaded) {
        const context = current.current
        if (!file || !kind || !name || !context || context.scope !== scope
            || context.request || context.done) return

        const target = { kind, name }
        function canSend() {
            return context.task.isCurrent()
                && store.getState().auth.connectionStatus === 'connected'
                && permission.current(target)
        }
        if (!canSend()) {
            setState({ scope: scope.key, status: 'error', error: 'Chưa thể gửi ảnh vào hội thoại này' })
            return
        }

        const request = {}
        context.request = request
        function isCurrent() {
            return current.current === context && context.request === request
                && context.task.isCurrent()
        }

        try {
            if (!context.image) {
                setState({ scope: scope.key, status: 'uploading', error: '' })
                const res = await context.task.start(file, target)
                if (!isCurrent()) return
                if (!res) {
                    setState({ scope: scope.key, status: 'idle', error: '' })
                    return
                }
                if (res.status === 'error') {
                    setState({ scope: scope.key, status: 'error', error: res.error.message })
                    return
                }
                context.image = res.data
            }

            if (!isCurrent()) return
            if (!canSend()) {
                // Giữ URL đã upload để lần xác nhận sau không tải cùng file lên lần nữa
                setState({ scope: scope.key, status: 'ready', error: 'Ảnh đã upload, chưa thể gửi vào hội thoại này' })
                return
            }

            context.done = true
            setState({ scope: scope.key, status: 'success', error: '' })
            onUploaded(context.image, target)
        } catch (err) {
            if (!isCurrent()) return
            if (context.done) {
                setState({
                    scope: scope.key, status: 'send-error',
                    error: 'Ảnh đã upload nhưng bước gửi gặp lỗi, kiểm tra tin chưa xác nhận trước khi thử lại',
                })
            } else {
                setState({ scope: scope.key, status: 'error', error: err instanceof Error ? err.message : 'Không upload được ảnh' })
            }
        } finally {
            if (context.request === request) {
                context.request = null
                if (current.current === context && !context.task.isCurrent()) {
                    setState({ scope: scope.key, status: 'idle', error: '' })
                }
            }
        }
    }

    return {
        status: state.scope === scope.key ? state.status : 'idle' as UploadStatus,
        error: state.scope === scope.key ? state.error : '',
        upload,
        cancel,
    }
}
