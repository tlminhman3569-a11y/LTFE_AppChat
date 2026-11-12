import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mock } from 'node:test'

registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(specifier === './socketClient' ? './socketClient.ts' : specifier, context)
    },
})

class TestSocket extends EventTarget {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    static sockets = []

    readyState = TestSocket.CONNECTING
    messages = []

    constructor() {
        super()
        TestSocket.sockets.push(this)
    }

    open() {
        this.readyState = TestSocket.OPEN
        this.onopen()
    }

    send(message) {
        this.messages.push(JSON.parse(message))
    }

    reply(status, data) {
        this.onmessage({ data: JSON.stringify({ event: 'LOGIN', status, data }) })
    }

    close() {
        this.readyState = TestSocket.CLOSING
    }

    finishClose() {
        this.readyState = TestSocket.CLOSED
        this.onclose()
        this.dispatchEvent(new Event('close'))
    }
}

globalThis.WebSocket = TestSocket
const { login } = await import('../src/services/authApi.ts')
const { socketClient } = await import('../src/services/socketClient.ts')
const flush = () => new Promise(resolve => setImmediate(resolve))

mock.timers.enable({ apis: ['setTimeout'] })
try {
    const denied = login('demo', 'sample')
    const first = TestSocket.sockets[0]
    first.open()
    await flush()
    assert.equal(first.messages[0].data.event, 'LOGIN')
    first.reply('error')
    assert.equal((await denied).error.kind, 'business')
    assert.equal(first.readyState, TestSocket.CLOSING)

    const timedOut = login('demo', 'sample')
    await flush()
    assert.equal(TestSocket.sockets.length, 1)
    first.finishClose()
    await flush()
    const second = TestSocket.sockets[1]
    second.open()
    await flush()
    mock.timers.tick(10_000)
    const timedOutResult = await timedOut
    assert.equal(timedOutResult.status, 'unknown')
    assert.equal(timedOutResult.error.kind, 'timeout')
    assert.equal(second.readyState, TestSocket.CLOSING)
    console.log('PASS: LOGIN error closes socket and retry waits for close')

    const retried = login('demo', 'sample')
    const lateResponse = second.onmessage
    second.finishClose()
    await flush()
    const third = TestSocket.sockets[2]
    third.open()
    await flush()
    lateResponse({ data: JSON.stringify({ event: 'LOGIN', status: 'success', data: { RE_LOGIN_CODE: 'old' } }) })
    third.reply('success', { RE_LOGIN_CODE: 'new' })
    const result = await retried
    assert.equal(result.status, 'success')
    assert.equal(result.data.reLoginCode, 'new')
    console.log('PASS: LOGIN timeout stays unknown and retry ignores the old response')
    const statuses = []
    const unsubscribe = socketClient.subscribeStatus(status => statuses.push(status))
    socketClient.clearSessionListeners()
    third.close()
    third.finishClose()
    assert.deepEqual(statuses, ['connected', 'disconnected'])

    const reopened = socketClient.connect('wss://chat.longapp.io.vn/chat/chat')
    const fourth = TestSocket.sockets[3]
    assert.deepEqual(statuses, ['connected', 'disconnected', 'connecting'])
    unsubscribe()
    fourth.open()
    await reopened
    assert.deepEqual(statuses, ['connected', 'disconnected', 'connecting'])
    socketClient.disconnect()
    fourth.finishClose()
    console.log('PASS: socket close updates status and unsubscribe stops updates')
} finally {
    mock.timers.reset()
}
