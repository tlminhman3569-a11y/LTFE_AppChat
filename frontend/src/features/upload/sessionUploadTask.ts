import { store } from '../../store'
import { createUploadTask } from './uploadTask'
import type { ConversationRef } from '../../types/api'

const uploads = new Set<() => void>()
let logoutGeneration: number | null = null

export function cancelSessionUploads() {
    // Chặn cả bộ quản lý mới trong lúc phiên cũ đang chờ LOGOUT
    logoutGeneration = store.getState().auth.sessionGeneration
    uploads.forEach(dispose => dispose())
}

export function createSessionUploadTask() {
    const task = createUploadTask()
    const { currentUser, sessionGeneration } = store.getState().auth
    let disposed = false

    function isCurrentSession() {
        const auth = store.getState().auth
        return !disposed && currentUser !== null && auth.authStatus === 'authenticated'
            && auth.currentUser === currentUser && auth.sessionGeneration === sessionGeneration
            && logoutGeneration !== sessionGeneration
    }

    function dispose() {
        if (disposed) return
        disposed = true
        task.cancel()
        unsubscribe()
        uploads.delete(dispose)
    }

    const unsubscribe = store.subscribe(() => {
        if (!isCurrentSession()) dispose()
    })
    uploads.add(dispose)
    if (!isCurrentSession()) dispose()

    async function start(file: File, conversation: ConversationRef) {
        if (!isCurrentSession()) return null

        try {
            const res = await task.start(file, conversation, sessionGeneration)
            if (!isCurrentSession()) return null

            return res
        } catch (err) {
            if (!isCurrentSession()) return null
            throw err
        }
    }

    return { start, cancel: task.cancel, dispose }
}
