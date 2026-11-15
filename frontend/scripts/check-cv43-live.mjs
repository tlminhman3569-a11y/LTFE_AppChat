/**
 * CV43 real API probe (standalone): one authenticated WebSocket, no mocks.
 * Node >= 22 with global WebSocket. Run with environment variables described
 * in docs/CV43_API_LOG.md. No usernames, passwords, chat content, tokens,
 * RE_LOGIN_CODE, or raw server frames are included in the generated report.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const vars = process.env
const user = vars.APPCHAT_PROBE_USER?.trim()
const pass = vars.APPCHAT_PROBE_PASS
const existing = vars.APPCHAT_PROBE_PEOPLE?.trim()
const missing = vars.APPCHAT_PROBE_NOT_FOUND?.trim()

if (!user || !pass || !existing || !missing || new Set([user, existing, missing].map(value => value.toLowerCase())).size !== 3) {
    console.error('CHƯA CHẠY: cần APPCHAT_PROBE_USER/PASS/PEOPLE/NOT_FOUND; ba username phải khác nhau.')
    process.exit(2)
}
if (typeof WebSocket !== 'function') {
    console.error('CHƯA CHẠY: Node hiện tại thiếu WebSocket tích hợp; cần Node.js >=22.')
    process.exit(2)
}

const projectScriptDir = dirname(fileURLToPath(import.meta.url))
const fixtureSource = readFileSync(resolve(projectScriptDir, '../src/fixtures/users.ts'), 'utf8')
const fixtureNames = [...fixtureSource.matchAll(/\busername:\s*['"]([^'"]+)['"]/g)]
    .map(match => match[1].toLowerCase())
if (fixtureNames.includes(existing.toLowerCase())) {
    console.error('CHƯA CHẠY: tài khoản A có trong fixture; hãy dùng một username có thật ngoài fixture.')
    process.exit(2)
}

const startedAt = new Date().toISOString()
let socket
let connectionStatus = 'not-connected'
let loginStatus = 'not-attempted'
let caseA = { status: 'not-tested', pass: false }
let caseB = { status: 'not-tested', pass: false }
let historyA = { status: 'not-tested', pass: false }

async function connect(url) {
    const ws = new WebSocket(url)
    await new Promise((done, fail) => {
        const timer = setTimeout(() => fail(new Error('connect-timeout')), 10000)
        ws.addEventListener('open', () => { clearTimeout(timer); done() }, { once: true })
        ws.addEventListener('error', () => { clearTimeout(timer); fail(new Error('connection-error')) }, { once: true })
        ws.addEventListener('close', () => { clearTimeout(timer); fail(new Error('closed-before-open')) }, { once: true })
    })
    return ws
}

function request(event, data, responseEvent = event) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('not-open'))
    return new Promise((done, fail) => {
        let settled = false
        const cleanup = () => {
            clearTimeout(timer)
            socket.removeEventListener('message', receive)
            socket.removeEventListener('close', onClose)
            socket.removeEventListener('error', onError)
        }
        const finish = (value, isError) => {
            if (settled) return
            settled = true
            cleanup()
            if (isError) fail(value)
            else done(value)
        }
        const receive = message => {
            let response
            try { response = JSON.parse(message.data) } catch { return }
            if (!response || response.event !== responseEvent) return
            finish(response, false)
        }
        const onClose = () => finish(new Error('connection-closed'), true)
        const onError = () => finish(new Error('connection-error'), true)
        const timer = setTimeout(() => {
            // An uncorrelated late response must never be assigned to the next username.
            finish(new Error('response-timeout'), true)
            if (socket?.readyState === WebSocket.OPEN) socket.close()
        }, 10000)
        socket.addEventListener('message', receive)
        socket.addEventListener('close', onClose)
        socket.addEventListener('error', onError)
        try { socket.send(JSON.stringify({ action: 'onchat', data: { event, data } })) }
        catch { finish(new Error('send-error'), true) }
    })
}

function checkedBoolean(response) {
    if (!response || response.event !== 'CHECK_USER_EXIST' ||
        (response.status !== 'success' && response.status !== undefined)) return null
    return typeof response.data?.status === 'boolean' ? response.data.status : null
}

async function checkUsername(target, expected) {
    try {
        const response = await request('CHECK_USER_EXIST', { user: target }, 'CHECK_USER_EXIST')
        const value = checkedBoolean(response)
        return {
            requestEvent: 'CHECK_USER_EXIST',
            responseEvent: 'CHECK_USER_EXIST',
            responseStatus: response.status === undefined ? 'absent' :
                response.status === 'success' ? 'success' : 'not-success',
            dataStatus: value === null ? 'unparseable' : value,
            pass: value === expected,
        }
    } catch (error) {
        return { requestEvent: 'CHECK_USER_EXIST', responseEvent: 'not-received',
            errorKind: error?.message === 'response-timeout' ? 'timeout' : 'connection', pass: false }
    }
}

async function checkHistory() {
    try {
        const response = await request('GET_PEOPLE_CHAT_MES', { name: existing, page: 1 })
        const items = response.status === 'success' && Array.isArray(response.data) ? response.data : null
        const valid = items !== null && items.every(message =>
            message && message.type === 0 &&
            typeof message.name === 'string' && typeof message.to === 'string' &&
            typeof message.mes === 'string' &&
            ((message.name === user && message.to === existing) ||
             (message.name === existing && message.to === user)))
        return { requestEvent: 'GET_PEOPLE_CHAT_MES', responseEvent: 'GET_PEOPLE_CHAT_MES',
            page: 1, responseStatus: response.status === 'success' ? 'success' : 'not-success',
            schemaAndPairValid: valid,
            messageCount: valid ? items.length : null,
            pass: valid }
    } catch (error) {
        return { requestEvent: 'GET_PEOPLE_CHAT_MES', page: 1,
            responseEvent: 'not-received', errorKind: error?.message === 'response-timeout' ? 'timeout' : 'connection', pass: false }
    }
}

try {
    socket = await connect('wss://chat.longapp.io.vn/chat/chat')
    connectionStatus = 'connected'
    const reply = await request('LOGIN', { user, pass })
    loginStatus = reply.status === 'success' &&
        typeof reply.data?.RE_LOGIN_CODE === 'string' && !!reply.data.RE_LOGIN_CODE.trim()
        ? 'success' : 'failed-or-unknown'
    if (loginStatus === 'success') {
        caseA = await checkUsername(existing, true)
        caseB = await checkUsername(missing, false)
        if (caseA.pass) historyA = await checkHistory()
    }
} catch {
    connectionStatus = socket?.readyState === WebSocket.OPEN ? 'connected' : 'not-connected'
} finally {
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close()
}

const apiPass = loginStatus === 'success' && caseA.pass && caseB.pass && historyA.pass
const logLines = [
    '# CV43 — WebSocket thật (metadata đã che)',
    `startedAtUTC: ${startedAt}`,
    `finishedAtUTC: ${new Date().toISOString()}`,
    'endpoint: wss://chat.longapp.io.vn/chat/chat',
    'testMode: real-websocket-one-connection (no mock, no fixture API responses)',
    'caseAOutsideFixture: true (checked against src/fixtures/users.ts)',
    `socket: ${connectionStatus}`,
    `LOGIN: ${loginStatus}`,
    `A-exists: ${JSON.stringify(caseA)}`,
    `B-not-found: ${JSON.stringify(caseB)}`,
    `A-history-page1: ${JSON.stringify(historyA)}`,
    `API_RESULT: ${apiPass ? 'PASS' : 'NOT_VERIFIED'}`,
    'UI_RESULT: NOT_TESTED (must click the actual CV43 UI separately)',
    'Sensitive input and message bodies: OMITTED',
]
writeFileSync(resolve(process.cwd(), 'CV43_API_LIVE_DA_CHE.txt'), logLines.join('\n') + '\n', { mode: 0o600 })
console.log(apiPass ? 'PASS: API WebSocket, log đã che đã tạo.' : 'NOT_VERIFIED: xem log đã che, không được ghi PASS.')
console.log('File: CV43_API_LIVE_DA_CHE.txt')
if (!apiPass) process.exitCode = 1
