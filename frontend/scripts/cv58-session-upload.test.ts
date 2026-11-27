import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSessionUploadTask, cancelSessionUploads } from '../src/features/upload/sessionUploadTask'
import { endSession } from '../src/features/auth/endSession'
import { uploadImage } from '../src/services/uploadApi'
import { logout } from '../src/services/authApi'
import { store } from '../src/store'
import { connectionStatusChanged, sessionChecking, sessionCleared, sessionReconnected, sessionStarted } from '../src/store/slices/authSlice'
import type { UploadResult } from '../src/types/media'

vi.mock('../src/services/uploadApi', () => ({ uploadImage: vi.fn() }))
vi.mock('../src/services/authApi', () => ({ logout: vi.fn() }))

const conversation = { kind: 'people' as const, name: 'minh_an' }
const uploaded: UploadResult = {
    status: 'success',
    data: {
        url: 'https://res.cloudinary.com/nhom-chat/image/upload/anh.jpg',
        publicId: 'anh', mimeType: 'image/jpeg', bytes: 3, width: 80, height: 60,
    },
}
const reqSpy = vi.mocked(uploadImage)
let file: File

function waitForUpload() {
    let resolve!: (res: UploadResult) => void
    let reject!: (err: Error) => void
    const promise = new Promise<UploadResult>((done, fail) => {
        resolve = done
        reject = fail
    })
    reqSpy.mockReturnValueOnce(promise)
    return { resolve, reject }
}

beforeEach(() => {
    vi.resetAllMocks()
    store.dispatch(sessionStarted('demo'))
    reqSpy.mockResolvedValue(uploaded)
    vi.mocked(logout).mockResolvedValue({ status: 'success', data: null })
    file = new File(['abc'], 'anh.jpg', { type: 'image/jpeg' })
})

afterEach(() => {
    cancelSessionUploads()
    store.dispatch(sessionCleared({}))
    vi.restoreAllMocks()
})

describe('upload theo phiên đăng nhập', () => {
    it('trả kết quả kèm đúng đích và phiên đã bắt đầu', async () => {
        const task = createSessionUploadTask()
        const generation = store.getState().auth.sessionGeneration

        const res = await task.start(file, conversation)

        expect(res).toEqual({ ...uploaded, conversation, sessionGeneration: generation })
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('chưa đăng nhập thì không gửi ảnh lên Cloudinary', async () => {
        store.dispatch(sessionCleared({}))
        const task = createSessionUploadTask()

        const res = await task.start(file, conversation)

        expect(res).toBeNull()
        expect(reqSpy).not.toHaveBeenCalled()
    })

    it('đăng nhập lại cùng username vẫn hủy upload của phiên trước', async () => {
        const reply = waitForUpload()
        const task = createSessionUploadTask()
        const pending = task.start(file, conversation)
        const signal = reqSpy.mock.calls[0][1]

        store.dispatch(sessionStarted('demo'))

        expect(signal?.aborted).toBe(true)

        reply.resolve(uploaded)
        const res = await pending

        expect(res).toBeNull()
    })

    it('đổi tài khoản không nhận lỗi trả muộn từ ảnh cũ', async () => {
        const reply = waitForUpload()
        const oldTask = createSessionUploadTask()
        const pending = oldTask.start(file, conversation)

        store.dispatch(sessionStarted('tai_khoan_khac'))
        reply.reject(new Error('Lỗi đọc phản hồi cũ'))
        const oldRes = await pending
        const newTask = createSessionUploadTask()
        const newRes = await newTask.start(file, conversation)

        expect(oldRes).toBeNull()
        expect(newRes?.status).toBe('success')
        expect(newRes?.sessionGeneration).toBe(store.getState().auth.sessionGeneration)
    })

    it('bỏ lỗi cũ nếu phiên đổi ngay trước khi caller nhận lỗi', async () => {
        const reply = waitForUpload()
        const task = createSessionUploadTask()
        const pending = task.start(file, conversation)

        // Service đã ném lỗi nhưng callback của caller chưa chạy thì tài khoản đổi
        reply.reject(new Error('Lỗi của ảnh cũ'))
        queueMicrotask(() => store.dispatch(sessionStarted('tai_khoan_khac')))
        const res = await pending

        expect(res).toBeNull()
    })

    it('lỗi ngoài dự kiến của phiên hiện tại vẫn trả về caller', async () => {
        const err = new Error('Không đọc được phản hồi')
        reqSpy.mockRejectedValueOnce(err)
        const task = createSessionUploadTask()
        let caught: unknown

        try {
            await task.start(file, conversation)
        } catch (error) {
            caught = error
        }

        expect(caught).toBe(err)
    })

    it('bắt đầu kiểm tra hoặc xóa phiên đều dừng upload đang chờ', async () => {
        for (const action of [sessionChecking(), sessionCleared({})]) {
            store.dispatch(sessionStarted('demo'))
            const reply = waitForUpload()
            const task = createSessionUploadTask()
            const pending = task.start(file, conversation)
            const signal = reqSpy.mock.calls[reqSpy.mock.calls.length - 1][1]

            store.dispatch(action)
            reply.resolve(uploaded)
            const res = await pending

            expect(signal?.aborted).toBe(true)
            expect(res).toBeNull()
        }
    })

    it('hủy ngay khi đăng xuất, không chờ máy chủ trả LOGOUT', async () => {
        let finishLogout!: (res: Awaited<ReturnType<typeof logout>>) => void
        vi.mocked(logout).mockReturnValue(new Promise(resolve => { finishLogout = resolve }))
        const reply = waitForUpload()
        const task = createSessionUploadTask()
        const pending = task.start(file, conversation)
        const signal = reqSpy.mock.calls[0][1]

        const signingOut = endSession()

        expect(signal?.aborted).toBe(true)
        expect(store.getState().auth.authStatus).toBe('authenticated')

        // Trong lúc chờ LOGOUT, tạo lại bộ quản lý cũng không được gửi ảnh khác
        const anotherTask = createSessionUploadTask()
        const blocked = await anotherTask.start(file, conversation)
        reply.resolve(uploaded)
        const oldRes = await pending
        finishLogout({ status: 'success', data: null })
        await signingOut

        expect(blocked).toBeNull()
        expect(oldRes).toBeNull()
        expect(reqSpy).toHaveBeenCalledOnce()
        expect(store.getState().auth.authStatus).toBe('unauthenticated')
    })

    it('đăng xuất dừng tất cả lượt nhưng phiên mới vẫn upload được', async () => {
        const replyA = waitForUpload()
        const replyB = waitForUpload()
        const taskA = createSessionUploadTask()
        const taskB = createSessionUploadTask()
        const pendingA = taskA.start(file, conversation)
        const pendingB = taskB.start(file, { kind: 'room', name: 'minh_an' })
        const signals = reqSpy.mock.calls.map(call => call[1])

        await endSession()
        replyA.resolve(uploaded)
        replyB.resolve(uploaded)
        const resA = await pendingA
        const resB = await pendingB
        store.dispatch(sessionStarted('demo'))
        const newTask = createSessionUploadTask()
        const newRes = await newTask.start(file, conversation)

        expect(signals.every(signal => signal?.aborted)).toBe(true)
        expect(resA).toBeNull()
        expect(resB).toBeNull()
        expect(newRes?.status).toBe('success')
    })

    it('bỏ ảnh bằng cancel rồi chọn ảnh khác vẫn upload được', async () => {
        const reply = waitForUpload()
        const task = createSessionUploadTask()
        const pending = task.start(file, conversation)

        task.cancel()
        reply.resolve(uploaded)
        const oldRes = await pending
        const newRes = await task.start(file, conversation)

        expect(oldRes).toBeNull()
        expect(newRes?.status).toBe('success')
    })

    it('dispose dọn listener và không cho dùng lại bộ quản lý cũ', async () => {
        const unsubscribe = vi.fn()
        vi.spyOn(store, 'subscribe').mockReturnValue(unsubscribe)
        const task = createSessionUploadTask()

        task.dispose()
        task.dispose()
        const res = await task.start(file, conversation)

        expect(unsubscribe).toHaveBeenCalledOnce()
        expect(res).toBeNull()
        expect(reqSpy).not.toHaveBeenCalled()
    })

    it('socket nối lại cùng phiên không làm hủy upload HTTP', async () => {
        const reply = waitForUpload()
        const task = createSessionUploadTask()
        const pending = task.start(file, conversation)
        const signal = reqSpy.mock.calls[0][1]

        store.dispatch(connectionStatusChanged('disconnected'))
        store.dispatch(connectionStatusChanged('reconnecting'))
        store.dispatch(sessionReconnected())
        reply.resolve(uploaded)
        const res = await pending

        expect(signal?.aborted).toBe(false)
        expect(res?.status).toBe('success')
    })
})
