import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { register } from '../src/services/authApi'
import { socketClient, SocketRequestError } from '../src/services/socketClient'

const URL = 'wss://chat.longapp.io.vn/chat/chat'

class FakeSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    static instances: FakeSocket[] = []

    readyState = FakeSocket.CONNECTING
    onopen: (() => void) | null = null
    onclose: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    send = vi.fn()

    constructor() {
        FakeSocket.instances.push(this)
    }

    open() {
        this.readyState = FakeSocket.OPEN
        this.onopen?.()
    }

    close() {
        this.readyState = FakeSocket.CLOSING
    }

    finishClose() {
        this.readyState = FakeSocket.CLOSED
        this.onclose?.()
    }

    reply(event: string, status = 'success') {
        this.onmessage?.({ data: JSON.stringify({ event, status }) })
    }
}

async function openSocket() {
    const connected = socketClient.connect(URL)
    const socket = FakeSocket.instances[FakeSocket.instances.length - 1]!
    socket.open()
    await connected
    return socket
}

beforeEach(() => {
    FakeSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeSocket)
})

afterEach(() => {
    socketClient.disconnect()
    FakeSocket.instances.forEach(socket => socket.finishClose())
    socketClient.clearSessionListeners()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('timeout của socketClient', () => {
    it('phân biệt yêu cầu timeout, đã gửi và còn trong hàng đợi', async () => {
        const socket = await openSocket()
        const first = socketClient.request('CREATE_ROOM').catch(err => err)
        const queued = socketClient.request('CREATE_ROOM').catch(err => err)
        await vi.advanceTimersByTimeAsync(100)
        const sent = socketClient.request('JOIN_ROOM').catch(err => err)

        await vi.advanceTimersByTimeAsync(9900)
        const [firstErr, queuedErr, sentErr] = await Promise.all([first, queued, sent])

        expect(firstErr).toBeInstanceOf(SocketRequestError)
        expect(firstErr).toMatchObject({ kind: 'timeout', wasSent: true })
        expect(queuedErr).toMatchObject({ kind: 'connection', wasSent: false })
        expect(sentErr).toMatchObject({ kind: 'connection', wasSent: true })
        expect(socket.send).toHaveBeenCalledTimes(2)
        expect(socket.readyState).toBe(FakeSocket.CLOSING)
        expect(socketClient.getStatus()).toBe('disconnected')
    })

    it('bỏ phản hồi và sự kiện đóng từ socket cũ', async () => {
        const oldSocket = await openSocket()
        const onReply = vi.fn()
        const onStatus = vi.fn()
        socketClient.subscribe('CREATE_ROOM', onReply)
        const unsubscribe = socketClient.subscribeStatus(onStatus)

        try {
            const expired = socketClient.request('CREATE_ROOM').catch(err => err)
            await vi.advanceTimersByTimeAsync(10_000)
            await expired
            expect(onStatus).toHaveBeenLastCalledWith('disconnected')

            // Socket mới phải dùng được ngay cả khi socket cũ còn đang đóng
            const newSocket = await openSocket()
            const next = socketClient.request('CREATE_ROOM')
            oldSocket.reply('CREATE_ROOM', 'error')
            oldSocket.finishClose()

            expect(newSocket).not.toBe(oldSocket)
            expect(newSocket.send).toHaveBeenCalledOnce()
            expect(onReply).not.toHaveBeenCalled()
            expect(onStatus.mock.calls.map(([status]) => status)).toEqual(['connected', 'disconnected', 'connecting', 'connected'])

            newSocket.reply('CREATE_ROOM')
            const res = await next

            expect(res).toEqual({ event: 'CREATE_ROOM', status: 'success' })
            expect(onReply).toHaveBeenCalledOnce()
        } finally {
            unsubscribe()
        }
    })

    it('trả unknown khi đăng ký đã gửi nhưng hết thời gian chờ', async () => {
        const socket = await openSocket()
        const pending = register('demo', 'sample-password')

        await vi.advanceTimersByTimeAsync(10_000)
        const res = await pending

        expect(socket.send).toHaveBeenCalledOnce()
        expect(res).toMatchObject({ status: 'unknown', error: { kind: 'timeout' } })
    })
})

describe('mở kết nối socket', () => {
    it('cho mở socket mới nếu socket cũ không mở đúng hạn', async () => {
        const pending = socketClient.connect(URL).catch(err => err)
        const oldSocket = FakeSocket.instances[0]

        await vi.advanceTimersByTimeAsync(10_000)
        const err = await pending

        expect(err).toMatchObject({ message: 'Hết thời gian mở kết nối WebSocket' })
        expect(oldSocket.readyState).toBe(FakeSocket.CLOSING)

        const newSocket = await openSocket()
        oldSocket.finishClose()

        expect(newSocket).not.toBe(oldSocket)
        expect(socketClient.getStatus()).toBe('connected')
    })
})
