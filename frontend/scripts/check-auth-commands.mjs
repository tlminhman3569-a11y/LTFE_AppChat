import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(specifier === './socketClient' ? './socketClient.ts' : specifier, context)
    },
})

const { register, logout } = await import('../src/services/authApi.ts')
const { socketClient, SocketRequestError } = await import('../src/services/socketClient.ts')
const calls = []
let reply = { status: 'success' }

socketClient.connect = async url => calls.push(['connect', url])
socketClient.getStatus = () => 'connected'
socketClient.request = async (...args) => {
    calls.push(args)
    if (reply instanceof Error) throw reply
    return reply
}
socketClient.disconnect = () => calls.push(['disconnect'])
socketClient.clearSessionListeners = () => calls.push(['clearSessionListeners'])

assert.deepEqual(await register('demo', 'sample'), { status: 'success', data: null })
assert.deepEqual(calls, [
    ['connect', 'wss://chat.longapp.io.vn/chat/chat'],
    ['REGISTER', { user: 'demo', pass: 'sample' }],
])
reply = { status: 'error' }
assert.equal((await register('demo', 'sample')).error.kind, 'business')
reply = {}
const invalidReply = await register('demo', 'sample')
assert.equal(invalidReply.status, 'unknown')
assert.equal(invalidReply.error.kind, 'parse')
reply = new SocketRequestError('timeout', 'timeout', true)
assert.equal((await register('demo', 'sample')).status, 'unknown')
console.log('PASS: REGISTER payload, success, refusal, invalid response and timeout')

calls.length = 0
reply = { status: 'success', data: 'logged out' }
const loggingOut = logout()
assert.equal(logout(), loggingOut)
assert.deepEqual(await loggingOut, { status: 'success', data: null })
assert.deepEqual(calls, [['LOGOUT'], ['disconnect'], ['clearSessionListeners']])

for (const [response, status, kind] of [
    [{ status: 'error' }, 'error', 'business'],
    [{}, 'unknown', 'parse'],
    [new SocketRequestError('timeout', 'timeout', true), 'unknown', 'timeout'],
]) {
    calls.length = 0
    reply = response
    const result = await logout()
    assert.equal(result.status, status)
    assert.equal(result.error.kind, kind)
    assert.deepEqual(calls, [['LOGOUT'], ['disconnect'], ['clearSessionListeners']])
}

calls.length = 0
socketClient.getStatus = () => 'disconnected'
assert.equal((await logout()).error.kind, 'connection')
assert.deepEqual(calls, [['disconnect'], ['clearSessionListeners']])
console.log('PASS: LOGOUT blocks duplicate requests and clears socket and listeners on every path')
