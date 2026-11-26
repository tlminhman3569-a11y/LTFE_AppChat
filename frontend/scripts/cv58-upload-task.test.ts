import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUploadTask } from '../src/features/upload/uploadTask'
import { uploadImage } from '../src/services/uploadApi'
import type { ConversationRef } from '../src/types/api'
import type { UploadResult } from '../src/types/media'

vi.mock('../src/services/uploadApi', () => ({ uploadImage: vi.fn() }))

const fakeImage = {
    url: 'https://res.cloudinary.com/nhom-chat/image/upload/anh.jpg',
    publicId: 'anh',
    mimeType: 'image/jpeg' as const,
    bytes: 3,
    width: 80,
    height: 60,
}
const uploaded: UploadResult = { status: 'success', data: fakeImage }
const reqSpy = vi.mocked(uploadImage)
let task: ReturnType<typeof createUploadTask>
let file: File

function waitForUpload() {
    let resolve!: (res: UploadResult) => void
    const promise = new Promise<UploadResult>(done => { resolve = done })
    return { promise, resolve }
}

beforeEach(() => {
    vi.resetAllMocks()
    reqSpy.mockResolvedValue(uploaded)
    task = createUploadTask()
    file = new File(['abc'], 'anh.jpg', { type: 'image/jpeg' })
})

afterEach(() => {
    task.cancel()
    vi.restoreAllMocks()
})

describe('tác vụ upload', () => {
    it('giữ file, đích và phiên tại lúc bắt đầu', async () => {
        const conversation: ConversationRef = { kind: 'people', name: 'minh_an' }

        const pending = task.start(file, conversation, 7)
        conversation.name = 'hoi_thoai_khac'
        const res = await pending
        const [sentFile, signal] = reqSpy.mock.calls[0]

        expect(sentFile).toBe(file)
        expect(signal).toBeInstanceOf(AbortSignal)
        expect(res).toEqual({
            ...uploaded,
            conversation: { kind: 'people', name: 'minh_an' },
            sessionGeneration: 7,
        })
    })

    it('trả lỗi upload kèm đúng phòng đang gửi', async () => {
        reqSpy.mockResolvedValue({ status: 'error', error: { kind: 'network', message: 'Không có phản hồi từ máy chủ' } })
        const room: ConversationRef = { kind: 'room', name: 'minh_an' }

        const res = await task.start(file, room, 3)

        expect(res).toEqual({
            status: 'error',
            error: { kind: 'network', message: 'Không có phản hồi từ máy chủ' },
            conversation: room,
            sessionGeneration: 3,
        })
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('hủy lượt đang chờ thì bỏ cả phản hồi thành công đến sau', async () => {
        const reply = waitForUpload()
        reqSpy.mockReturnValue(reply.promise)
        const pending = task.start(file, { kind: 'room', name: 'nhom_hoc' }, 1)
        const signal = reqSpy.mock.calls[0][1]

        task.cancel()
        reply.resolve(uploaded)
        const res = await pending

        expect(signal?.aborted).toBe(true)
        expect(res).toBeNull()
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('bắt đầu ảnh mới sẽ hủy ảnh cũ, chỉ trả kết quả mới', async () => {
        const oldReply = waitForUpload()
        reqSpy.mockReturnValueOnce(oldReply.promise)
        const oldUpload = task.start(file, { kind: 'people', name: 'ban_a' }, 1)
        const oldSignal = reqSpy.mock.calls[0][1]
        const nextFile = new File(['new'], 'anh-moi.jpg', { type: 'image/jpeg' })

        const current = await task.start(nextFile, { kind: 'room', name: 'ban_a' }, 2)
        oldReply.resolve(uploaded)
        const stale = await oldUpload

        expect(oldSignal?.aborted).toBe(true)
        expect(reqSpy.mock.calls[1][0]).toBe(nextFile)
        expect(current).toMatchObject({ status: 'success', conversation: { kind: 'room', name: 'ban_a' }, sessionGeneration: 2 })
        expect(stale).toBeNull()
    })

    it('Fetch ném lỗi do abort thì lượt đã hủy cũng trả null', async () => {
        reqSpy.mockImplementationOnce((_file, signal) => new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
        }))
        const pending = task.start(file, { kind: 'room', name: 'nhom_hoc' }, 1)

        task.cancel()
        const res = await pending

        expect(res).toBeNull()
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('lượt cũ kết thúc không làm mất khả năng hủy lượt mới', async () => {
        const oldReply = waitForUpload()
        const newReply = waitForUpload()
        reqSpy.mockReturnValueOnce(oldReply.promise).mockReturnValueOnce(newReply.promise)
        const oldUpload = task.start(file, { kind: 'people', name: 'ban_a' }, 1)
        const newUpload = task.start(file, { kind: 'people', name: 'ban_b' }, 1)
        const newSignal = reqSpy.mock.calls[1][1]

        // Lượt đã bị thay thế trả về trước khi người dùng hủy lượt hiện tại
        oldReply.resolve(uploaded)
        await oldUpload
        task.cancel()
        newReply.resolve(uploaded)
        const res = await newUpload

        expect(newSignal?.aborted).toBe(true)
        expect(res).toBeNull()
    })

    it('cancel nhiều lần hoặc sau khi xong đều không phát sinh request', async () => {
        task.cancel()
        const res = await task.start(file, { kind: 'room', name: 'nhom_hoc' }, 1)
        const signal = reqSpy.mock.calls[0][1]

        task.cancel()
        task.cancel()

        expect(res?.status).toBe('success')
        expect(signal?.aborted).toBe(false)
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('hai bộ upload riêng không hủy lẫn nhau', async () => {
        const replyA = waitForUpload()
        const replyB = waitForUpload()
        reqSpy.mockReturnValueOnce(replyA.promise).mockReturnValueOnce(replyB.promise)
        const otherTask = createUploadTask()
        const uploadA = task.start(file, { kind: 'people', name: 'ban_a' }, 1)
        const uploadB = otherTask.start(file, { kind: 'people', name: 'ban_b' }, 1)
        const signalB = reqSpy.mock.calls[1][1]

        task.cancel()
        replyA.resolve(uploaded)
        replyB.resolve(uploaded)
        const resA = await uploadA
        const resB = await uploadB

        expect(resA).toBeNull()
        expect(resB?.status).toBe('success')
        expect(signalB?.aborted).toBe(false)
        otherTask.cancel()
    })

    it('lỗi ngoài dự kiến vẫn được báo, lượt sau tiếp tục dùng được', async () => {
        const err = new Error('Lỗi khi đọc cấu hình')
        reqSpy.mockRejectedValueOnce(err)

        const failure = await task.start(file, { kind: 'room', name: 'nhom_hoc' }, 1).catch(error => error)
        const res = await task.start(file, { kind: 'room', name: 'nhom_hoc' }, 1)

        expect(failure).toBe(err)
        expect(res?.status).toBe('success')
        expect(reqSpy).toHaveBeenCalledTimes(2)
    })
})
