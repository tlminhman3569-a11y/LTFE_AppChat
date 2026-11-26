import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadImage } from '../src/services/uploadApi'
import { maxImageBytes } from '../src/types/media'

const reqSpy = vi.fn<typeof fetch>()
const fakeReply = {
    secure_url: 'https://res.cloudinary.com/nhom-chat/image/upload/v1/anh-thu.jpg',
    public_id: 'anh-thu',
    resource_type: 'image',
    format: 'jpg',
    bytes: 3,
    width: 800,
    height: 600,
}
let file: File

beforeEach(() => {
    reqSpy.mockReset()
    vi.stubGlobal('fetch', reqSpy)
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'nhom-chat')
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'anh_demo')
    file = new File(['abc'], 'anh.jpg', { type: 'image/jpeg' })
    reqSpy.mockResolvedValue(Response.json(fakeReply))
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})

describe('uploadImage', () => {
    it('upload ảnh bằng FormData rồi lấy URL và metadata', async () => {
        const res = await uploadImage(file)
        const [url, options] = reqSpy.mock.calls[0]
        const body = options?.body as FormData
        const keys: string[] = []
        body.forEach((_value, key) => keys.push(key))

        expect(reqSpy).toHaveBeenCalledOnce()
        expect(url).toBe('https://api.cloudinary.com/v1_1/nhom-chat/image/upload')
        expect(options).toMatchObject({ method: 'POST', credentials: 'omit' })
        expect(options?.headers).toBeUndefined()
        expect(body.get('file')).toBe(file)
        expect(body.get('upload_preset')).toBe('anh_demo')
        expect(keys).toEqual(['file', 'upload_preset'])
        expect(res).toEqual({
            status: 'success',
            data: {
                url: fakeReply.secure_url,
                publicId: 'anh-thu',
                mimeType: 'image/jpeg',
                bytes: 3,
                width: 800,
                height: 600,
            },
        })
    })

    it.each(['png', 'webp', 'jpeg'])('đọc được ảnh %s trả về', async format => {
        const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
        const input = new File(['abc'], `anh.${format}`, { type: mime })
        reqSpy.mockResolvedValue(Response.json({ ...fakeReply, format }))

        const res = await uploadImage(input)

        expect(res).toMatchObject({ status: 'success', data: { mimeType: mime } })
    })

    it('thiếu cloud name hoặc preset thì không gửi file', async () => {
        const settings = [
            ['VITE_CLOUDINARY_CLOUD_NAME', 'nhom-chat'],
            ['VITE_CLOUDINARY_UPLOAD_PRESET', 'anh_demo'],
        ]
        for (const [key, value] of settings) {
            vi.stubEnv(key, ' ')

            const res = await uploadImage(file)

            expect(res).toMatchObject({ status: 'error', error: { kind: 'config' } })
            vi.stubEnv(key, value)
        }
        expect(reqSpy).not.toHaveBeenCalled()
    })

    it('cloud name không được chứa đường dẫn', async () => {
        vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', '../cloud-khac')

        const res = await uploadImage(file)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'config' } })
        expect(reqSpy).not.toHaveBeenCalled()
    })

    it('bỏ khoảng trắng thừa trong env', async () => {
        vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', ' nhom-chat ')
        vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', ' anh_demo ')

        const res = await uploadImage(file)
        const [url, options] = reqSpy.mock.calls[0]
        const body = options?.body as FormData

        expect(res.status).toBe('success')
        expect(url).toBe('https://api.cloudinary.com/v1_1/nhom-chat/image/upload')
        expect(body.get('upload_preset')).toBe('anh_demo')
    })

    it('chặn file rỗng và loại ảnh chưa hỗ trợ', async () => {
        const files = [
            new File([], 'rong.jpg', { type: 'image/jpeg' }),
            new File(['abc'], 'anh.gif', { type: 'image/gif' }),
            new File(['abc'], 'anh.svg', { type: 'image/svg+xml' }),
            new File(['abc'], 'anh.jpg'),
        ]

        for (const input of files) {
            const res = await uploadImage(input)

            expect(res).toMatchObject({ status: 'error', error: { kind: 'validation' } })
        }
        expect(reqSpy).not.toHaveBeenCalled()
    })

    it('đúng 5 MiB vẫn gửi, hơn một byte thì chặn', async () => {
        const limit = new File([new Uint8Array(maxImageBytes)], 'vua-du.jpg', { type: 'image/jpeg' })
        const large = new File([new Uint8Array(maxImageBytes + 1)], 'qua-lon.jpg', { type: 'image/jpeg' })
        reqSpy.mockResolvedValue(Response.json({ ...fakeReply, bytes: maxImageBytes }))

        const accepted = await uploadImage(limit)
        const rejected = await uploadImage(large)

        expect(accepted.status).toBe('success')
        expect(rejected).toMatchObject({ status: 'error', error: { kind: 'validation' } })
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('giữ mã HTTP khi Cloudinary từ chối upload', async () => {
        reqSpy.mockResolvedValue(new Response('Bad request', { status: 400 }))

        const res = await uploadImage(file)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'http', statusCode: 400 } })
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('mất phản hồi thì báo lỗi mạng, không tự gửi lại', async () => {
        reqSpy.mockRejectedValue(new TypeError('Failed to fetch'))

        const res = await uploadImage(file)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'network' } })
        expect(reqSpy).toHaveBeenCalledOnce()
    })

    it('báo parse nếu JSON đọc không được', async () => {
        reqSpy.mockResolvedValue(new Response('{broken'))

        const res = await uploadImage(file)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'parse' } })
    })

    it('không nhận response thiếu hoặc sai thông tin ảnh', async () => {
        const replies = [
            null, [], {},
            { ...fakeReply, resource_type: 'raw' },
            { ...fakeReply, format: 'gif' },
            { ...fakeReply, public_id: ' ' },
            { ...fakeReply, bytes: '3' },
            { ...fakeReply, bytes: 0 },
            { ...fakeReply, bytes: maxImageBytes + 1 },
            { ...fakeReply, width: 0 },
            { ...fakeReply, height: 0 },
        ]

        for (const reply of replies) {
            reqSpy.mockResolvedValue(Response.json(reply))

            const res = await uploadImage(file)

            expect(res, JSON.stringify(reply)).toMatchObject({ status: 'error', error: { kind: 'parse' } })
        }
    })

    it('chỉ nhận URL ảnh HTTPS từ cloud của nhóm', async () => {
        const urls = [
            'http://res.cloudinary.com/nhom-chat/image/upload/anh.jpg',
            'https://res.cloudinary.com.evil.test/nhom-chat/image/upload/anh.jpg',
            'https://res.cloudinary.com/cloud-khac/image/upload/anh.jpg',
            'https://res.cloudinary.com/nhom-chat/video/upload/anh.jpg',
            'https://user:pass@res.cloudinary.com/nhom-chat/image/upload/anh.jpg',
            'https://res.cloudinary.com:444/nhom-chat/image/upload/anh.jpg',
            'https://res.cloudinary.com/nhom-chat/image/upload/../../../cloud-khac/image/upload/anh.jpg',
            'https://res.cloudinary.com/nhom-chat/image/upload/%2e%2e/%2e%2e/%2e%2e/cloud-khac/image/upload/anh.jpg',
            'https://res.cloudinary.com/nhom-chat/image/upload/..\\..\\..\\cloud-khac/image/upload/anh.jpg',
            'blob:anh-thu',
            'khong-phai-url',
        ]

        for (const url of urls) {
            reqSpy.mockResolvedValue(Response.json({ ...fakeReply, secure_url: url }))

            const res = await uploadImage(file)

            expect(res, url).toMatchObject({ status: 'error', error: { kind: 'parse' } })
        }
    })

    it('nhận URL hợp lệ sau khi chuẩn hóa cổng HTTPS mặc định', async () => {
        const url = 'https://res.cloudinary.com:443/nhom-chat/image/upload/v1/anh-thu.jpg'
        reqSpy.mockResolvedValue(Response.json({ ...fakeReply, secure_url: url }))

        const res = await uploadImage(file)

        expect(res).toMatchObject({ status: 'success', data: { url } })
    })

    it('hủy trước khi gửi thì không gọi Fetch', async () => {
        const controller = new AbortController()
        controller.abort()

        const res = await uploadImage(file, controller.signal)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'aborted' } })
        expect(reqSpy).not.toHaveBeenCalled()
    })

    it('hủy được upload đang chờ', async () => {
        const controller = new AbortController()
        reqSpy.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
        }))

        const pending = uploadImage(file, controller.signal)
        controller.abort()
        const res = await pending

        expect(reqSpy.mock.calls[0][1]?.signal).toBe(controller.signal)
        expect(res).toMatchObject({ status: 'error', error: { kind: 'aborted' } })
    })

    it('đã nhận header vẫn có thể hủy lúc đọc body', async () => {
        const controller = new AbortController()
        const reply = Response.json(fakeReply)
        vi.spyOn(reply, 'json').mockImplementation(async () => {
            // Upload đã tới server, hủy ở đây không có nghĩa ảnh chưa được lưu
            controller.abort()
            throw controller.signal.reason
        })
        reqSpy.mockResolvedValue(reply)

        const res = await uploadImage(file, controller.signal)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'aborted' } })
    })
})
