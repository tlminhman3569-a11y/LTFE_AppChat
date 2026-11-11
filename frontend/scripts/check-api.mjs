import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(specifier === './socketClient' ? './socketClient.ts' : specifier, context)
    },
})

const username = process.env.APPCHAT_PROBE_USER
const password = process.env.APPCHAT_PROBE_PASS
if (!username || !password) {
    console.error('Set APPCHAT_PROBE_USER and APPCHAT_PROBE_PASS for the test account')
    process.exit(1)
}

const base = new URL('../src/services/', import.meta.url).href
const { login } = await import(base + 'authApi.ts')
const { socketClient } = await import(base + 'socketClient.ts')
const deadline = setTimeout(() => {
    console.error('FAIL: API probe timed out')
    process.exit(1)
}, 25_000)

try {
    const session = await login(username, password)
    assert.ok(session.status === 'success', 'LOGIN did not succeed')
    const reply = await socketClient.request('GET_USER_LIST', {})
    assert.ok(reply.status === 'success' && Array.isArray(reply.data), 'GET_USER_LIST did not return a successful array')
    assert.ok(reply.data.every(row => row && typeof row.name === 'string'
        && (row.type === 0 || row.type === 1) && typeof row.actionTime === 'string'), 'Unexpected list entry shape')
    console.log(`PASS: LOGIN and GET_USER_LIST (${reply.data.length} entries)`)
} catch {
    console.error('FAIL: LOGIN or GET_USER_LIST did not match the expected response')
    process.exitCode = 1
} finally {
    clearTimeout(deadline)
    socketClient.disconnect()
}
