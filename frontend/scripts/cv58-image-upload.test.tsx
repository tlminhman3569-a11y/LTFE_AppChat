// @vitest-environment jsdom
import { act, StrictMode, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useImageUpload } from '../src/features/upload/useImageUpload'
import { uploadImage } from '../src/services/uploadApi'
import { logout } from '../src/services/authApi'
import { endSession } from '../src/features/auth/endSession'
import { store } from '../src/store'
import { connectionStatusChanged, sessionCleared, sessionStarted } from '../src/store/slices/authSlice'
import type { UploadResult } from '../src/types/media'

vi.mock('../src/services/uploadApi', () => ({ uploadImage: vi.fn() }))
vi.mock('../src/services/authApi', () => ({ logout: vi.fn() }))

const people = { kind: 'people' as const, name: 'minh_an' }
const room = { kind: 'room' as const, name: 'minh_an' }
const fakeImage = {
    url: 'https://res.cloudinary.com/nhom-chat/image/upload/anh.jpg',
    publicId: 'anh', mimeType: 'image/jpeg' as const, bytes: 3, width: 80, height: 60,
}
const uploaded: UploadResult = { status: 'success', data: fakeImage }
const reqSpy = vi.mocked(uploadImage)
const onUploaded = vi.fn()
const canSendNow = vi.fn(() => allowed)
let allowed: boolean
let root: Root
let host: HTMLDivElement
let api: ReturnType<typeof useImageUpload>
let props: Parameters<typeof useImageUpload>[0]

function Probe() {
    const upload = useImageUpload(props)
    useLayoutEffect(() => { api = upload })
    return <p>{upload.status}{upload.error}</p>
}

async function render(patch: Partial<typeof props> = {}, strict = false) {
    props = { ...props, ...patch }
    await act(async () => {
        root.render(<Provider store={store}>{strict ? <StrictMode><Probe /></StrictMode> : <Probe />}</Provider>)
    })
}

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
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    allowed = true
    canSendNow.mockImplementation(() => allowed)
    reqSpy.mockResolvedValue(uploaded)
    vi.mocked(logout).mockResolvedValue({ status: 'success', data: null })
    store.dispatch(sessionStarted('demo'))
    store.dispatch(connectionStatusChanged('connected'))
    props = {
        file: new File(['abc'], 'anh.jpg', { type: 'image/jpeg' }),
        conversation: people,
        canSendNow,
    }
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
})

afterEach(async () => {
    await act(async () => { root.unmount() })
    host.remove()
    store.dispatch(sessionCleared({}))
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('upload ảnh trong composer', () => {
    it('chọn ảnh chưa upload, bấm liên tiếp cũng chỉ bàn giao một lần', async () => {
        const reply = waitForUpload()
        await render()

        expect(reqSpy).not.toHaveBeenCalled()

        let pending!: Promise<void>
        await act(async () => {
            pending = api.upload(onUploaded)
            await api.upload(onUploaded)
        })

        expect(api.status).toBe('uploading')
        expect(reqSpy).toHaveBeenCalledOnce()

        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })
        await act(async () => { await api.upload(onUploaded) })

        expect(api.status).toBe('success')
        expect(onUploaded).toHaveBeenCalledExactlyOnceWith(fakeImage, people)
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('chưa có file hoặc đích thì không gọi upload', async () => {
        await render({ file: null })

        await act(async () => { await api.upload(onUploaded) })
        await render({ file: new File(['x'], 'anh.png'), conversation: null })
        await act(async () => { await api.upload(onUploaded) })

        expect(reqSpy).not.toHaveBeenCalled()
        expect(onUploaded).not.toHaveBeenCalled()
    })

    it('không có quyền gửi thì chặn ngay trước request', async () => {
        allowed = false
        await render()

        await act(async () => { await api.upload(onUploaded) })

        expect(reqSpy).not.toHaveBeenCalled()
        expect(api.status).toBe('error')
        expect(api.error).toBe('Chưa thể gửi ảnh vào hội thoại này')
    })

    it('bỏ ảnh hủy request, URL cũ về sau không được chuyển cho bước gửi', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })
        const signal = reqSpy.mock.calls[0][1]

        await render({ file: null })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(signal?.aborted).toBe(true)
        expect(api.status).toBe('idle')
        expect(onUploaded).not.toHaveBeenCalled()
    })

    it('đổi file khi đang chờ không để lỗi cũ đè lên ảnh mới', async () => {
        const oldReply = waitForUpload()
        const newReply = waitForUpload()
        await render()
        let oldPending!: Promise<void>
        let newPending!: Promise<void>
        await act(async () => { oldPending = api.upload(onUploaded) })

        const newFile = new File(['png'], 'anh-moi.png', { type: 'image/png' })
        await render({ file: newFile })
        await act(async () => { newPending = api.upload(onUploaded) })
        await act(async () => {
            oldReply.reject(new Error('Lỗi của file cũ'))
            await oldPending
        })

        expect(api.status).toBe('uploading')
        expect(api.error).toBe('')

        await act(async () => {
            newReply.resolve(uploaded)
            await newPending
        })

        expect(reqSpy.mock.calls[1][0]).toBe(newFile)
        expect(onUploaded).toHaveBeenCalledOnce()
    })

    it('người và phòng trùng tên vẫn là hai đích khác nhau', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })

        await render({ conversation: room })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })
        await act(async () => { await api.upload(onUploaded) })

        expect(onUploaded).toHaveBeenCalledExactlyOnceWith(fakeImage, room)
        expect(reqSpy).toHaveBeenCalledTimes(2)
    })

    it('render lại cùng file và cùng đích không hủy request đang chạy', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })
        const signal = reqSpy.mock.calls[0][1]

        await render({ conversation: { ...people } })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(signal?.aborted).toBe(false)
        expect(reqSpy).toHaveBeenCalledOnce()
        expect(onUploaded).toHaveBeenCalledOnce()
    })

    it('callback upload của file đã bỏ không khởi động lại tác vụ cũ', async () => {
        await render()
        const oldUpload = api.upload

        await render({ file: null })
        await act(async () => { await oldUpload(onUploaded) })

        expect(reqSpy).not.toHaveBeenCalled()
    })

    it('unmount hủy upload và bỏ qua phản hồi đến muộn', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })
        const signal = reqSpy.mock.calls[0][1]

        await act(async () => { root.render(null) })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(signal?.aborted).toBe(true)
        expect(onUploaded).not.toHaveBeenCalled()
    })

    it('StrictMode dọn effect rồi dựng lại vẫn upload được', async () => {
        await render({}, true)

        await act(async () => { await api.upload(onUploaded) })

        expect(api.status).toBe('success')
        expect(reqSpy).toHaveBeenCalledOnce()
        expect(onUploaded).toHaveBeenCalledOnce()
    })

    it('đổi tài khoản không bàn giao ảnh của phiên trước', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })
        const signal = reqSpy.mock.calls[0][1]

        await act(async () => { store.dispatch(sessionStarted('tai_khoan_khac')) })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(signal?.aborted).toBe(true)
        expect(api.status).toBe('idle')
        expect(onUploaded).not.toHaveBeenCalled()
    })

    it('logout đang chờ máy chủ cũng không nhận URL upload trả về', async () => {
        let finishLogout!: (res: Awaited<ReturnType<typeof logout>>) => void
        vi.mocked(logout).mockReturnValue(new Promise(resolve => { finishLogout = resolve }))
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        let signingOut!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })

        await act(async () => { signingOut = endSession() })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(onUploaded).not.toHaveBeenCalled()
        expect(api.status).toBe('idle')

        await act(async () => {
            finishLogout({ status: 'success', data: null })
            await signingOut
        })
    })

    it('mất quyền lúc ảnh trả về thì giữ URL, xác nhận lại không upload lần nữa', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })

        // Quyền đổi trước khi React render lại vẫn phải chặn bước gửi
        allowed = false
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(api.status).toBe('ready')
        expect(onUploaded).not.toHaveBeenCalled()

        allowed = true
        await act(async () => { await api.upload(onUploaded) })

        expect(reqSpy).toHaveBeenCalledOnce()
        expect(onUploaded).toHaveBeenCalledExactlyOnceWith(fakeImage, people)
    })

    it('đứt socket không hủy HTTP, nối lại cần xác nhận gửi thêm lần nữa', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })
        const signal = reqSpy.mock.calls[0][1]

        await act(async () => { store.dispatch(connectionStatusChanged('disconnected')) })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(signal?.aborted).toBe(false)
        expect(api.status).toBe('ready')
        expect(onUploaded).not.toHaveBeenCalled()

        await act(async () => { store.dispatch(connectionStatusChanged('connected')) })

        expect(onUploaded).not.toHaveBeenCalled()

        await act(async () => { await api.upload(onUploaded) })

        expect(reqSpy).toHaveBeenCalledOnce()
        expect(onUploaded).toHaveBeenCalledOnce()
    })

    it('lỗi mạng giữ thông báo gốc và chỉ thử lại khi người dùng xác nhận', async () => {
        reqSpy.mockResolvedValueOnce({
            status: 'error', error: { kind: 'network', message: 'Không có phản hồi từ máy chủ' },
        })
        await render()

        await act(async () => { await api.upload(onUploaded) })

        expect(api.status).toBe('error')
        expect(api.error).toBe('Không có phản hồi từ máy chủ')
        expect(reqSpy).toHaveBeenCalledOnce()

        await act(async () => { await api.upload(onUploaded) })

        expect(api.status).toBe('success')
        expect(onUploaded).toHaveBeenCalledOnce()
    })

    it('callback kiểm tra quyền mới được dùng mà không hủy upload đang chờ', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })
        const signal = reqSpy.mock.calls[0][1]
        const checkPermission = vi.fn(() => false)

        await render({ canSendNow: checkPermission })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })

        expect(signal?.aborted).toBe(false)
        expect(checkPermission).toHaveBeenCalledWith(people)
        expect(api.status).toBe('ready')
        expect(onUploaded).not.toHaveBeenCalled()
    })

    it('logout chen giữa lúc nhận URL và bàn giao cũng phải chặn bước gửi', async () => {
        let finishLogout!: (res: Awaited<ReturnType<typeof logout>>) => void
        vi.mocked(logout).mockReturnValue(new Promise(resolve => { finishLogout = resolve }))
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        let signingOut!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })

        await act(async () => {
            reply.resolve(uploaded)
            // Wrapper đã trả ảnh, nhưng hook chưa dùng URL thì người dùng đăng xuất
            queueMicrotask(() => queueMicrotask(() => { signingOut = endSession() }))
            await pending
        })

        expect(store.getState().auth.authStatus).toBe('authenticated')
        expect(onUploaded).not.toHaveBeenCalled()
        expect(api.status).toBe('idle')

        await act(async () => {
            finishLogout({ status: 'success', data: null })
            await signingOut
        })
    })

    it('lỗi ngoài dự kiến không khóa luôn lần upload tiếp theo', async () => {
        const err = new Error('Không đọc được phản hồi')
        reqSpy.mockRejectedValueOnce(err)
        await render()

        await act(async () => { await api.upload(onUploaded) })

        expect(api.status).toBe('error')
        expect(api.error).toBe(err.message)

        await act(async () => { await api.upload(onUploaded) })

        expect(reqSpy).toHaveBeenCalledTimes(2)
        expect(onUploaded).toHaveBeenCalledOnce()
    })

    it('bước gửi ném lỗi thì không tự bàn giao cùng URL thêm lần nữa', async () => {
        const send = vi.fn(() => { throw new Error('Kết nối vừa ngắt lúc gửi') })
        await render()

        await act(async () => { await api.upload(send) })
        await act(async () => { await api.upload(send) })

        expect(reqSpy).toHaveBeenCalledOnce()
        expect(send).toHaveBeenCalledOnce()
        expect(api.status).toBe('send-error')
        expect(api.error).toContain('kiểm tra tin chưa xác nhận')
    })

    it('hủy thủ công cho phép chọn gửi lại nhưng lượt cũ không còn tác dụng', async () => {
        const reply = waitForUpload()
        await render()
        let pending!: Promise<void>
        await act(async () => { pending = api.upload(onUploaded) })

        await act(async () => { api.cancel() })
        await act(async () => {
            reply.resolve(uploaded)
            await pending
        })
        await act(async () => { await api.upload(onUploaded) })

        expect(reqSpy).toHaveBeenCalledTimes(2)
        expect(onUploaded).toHaveBeenCalledOnce()
    })
})
