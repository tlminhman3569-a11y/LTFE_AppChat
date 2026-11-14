import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from '../src/services/apiClient'

const URL = 'https://example.test/resource'
const reqSpy = vi.fn<typeof fetch>()

beforeEach(() => {
    reqSpy.mockReset()
    vi.stubGlobal('fetch', reqSpy)
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('fetchJson', () => {
    it('đọc JSON và gửi đúng header đã truyền', async () => {
        const payload = { ready: true }
        const options = { headers: { Accept: 'application/json' } }
        reqSpy.mockResolvedValue(Response.json(payload))

        const res = await fetchJson<typeof payload>(URL, options)

        expect(res).toEqual({ status: 'success', data: payload })
        expect(reqSpy).toHaveBeenCalledExactlyOnceWith(URL, options)
    })

    it('giữ mã 503 khi server trả nội dung dạng text', async () => {
        const reply = new Response('Service unavailable', { status: 503 })
        const readBody = vi.spyOn(reply, 'json')
        reqSpy.mockResolvedValue(reply)

        const res = await fetchJson(URL)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'http', statusCode: 503 } })
        expect(readBody).not.toHaveBeenCalled()
    })

    it('trả lỗi mạng nếu fetch không nhận được phản hồi', async () => {
        const err = new TypeError('Failed to fetch')
        reqSpy.mockRejectedValue(err)

        const res = await fetchJson(URL)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'network' } })
    })

    it('báo lỗi parse khi server trả 200 nhưng JSON hỏng', async () => {
        reqSpy.mockResolvedValue(new Response('{broken'))

        const res = await fetchJson(URL)

        expect(res).toMatchObject({ status: 'error', error: { kind: 'parse' } })
    })
})

describe('hủy yêu cầu Fetch', () => {
    it('nhận ra yêu cầu bị hủy dù dùng lỗi tùy chỉnh', async () => {
        const controller = new AbortController()
        const reason = new Error('Dừng yêu cầu')
        reqSpy.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
        }))

        const pending = fetchJson(URL, { signal: controller.signal })
        controller.abort(reason)
        const res = await pending

        expect(res).toMatchObject({ status: 'error', error: { kind: 'aborted' } })
    })

    it('vẫn báo đã hủy nếu abort trong lúc đọc body', async () => {
        const controller = new AbortController()
        const reply = Response.json({ ready: true })
        let startReading!: () => void
        const reading = new Promise<void>(resolve => { startReading = resolve })
        vi.spyOn(reply, 'json').mockImplementation(() => new Promise((_resolve, reject) => {
            controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })
            startReading()
        }))
        reqSpy.mockResolvedValue(reply)

        const pending = fetchJson(URL, { signal: controller.signal })
        // Đợi fetch nhận phản hồi và bắt đầu đọc body rồi mới hủy
        await reading
        controller.abort()
        const res = await pending

        expect(res).toMatchObject({ status: 'error', error: { kind: 'aborted' } })
    })
})
