import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const probeOnly = process.argv.includes('--probe')
const url = process.env.CV43_WS_URL || 'wss://chat.longapp.io.vn/chat/chat'
const evidencePath = resolve(process.env.CV43_EVIDENCE_FILE || 'cv43-live-evidence.json')
const username = process.env.CV43_LIVE_USER
const password = process.env.CV43_LIVE_PASS
const peer = process.env.CV43_LIVE_PEER
const missing = process.env.CV43_LIVE_MISSING
const isProduction = url === 'wss://chat.longapp.io.vn/chat/chat'
const timeoutMs = 10000

if (!probeOnly && (!username || !password || !peer || !missing)) {
    console.error('Cần CV43_LIVE_USER, CV43_LIVE_PASS, CV43_LIVE_PEER, CV43_LIVE_MISSING; hoặc chạy --probe chỉ kiểm tra bắt tay.')
    process.exit(2)
}
if (!probeOnly && (username.toLowerCase() === peer.toLowerCase() || peer.toLowerCase() === missing.toLowerCase())) {
    console.error('Tài khoản kiểm thử phải khác tài khoản đích; tên không tồn tại phải khác tên đang tồn tại.')
    process.exit(2)
}

const report = {
    createdAt: new Date().toISOString(),
    nodeVersion: process.version,
    mode: probeOnly ? 'handshake-only' : 'authenticated-checks',
    url: isProduction ? url : '[custom URL redacted]',
    endpointCategory: isProduction ? 'production' : 'custom',
    transport: 'not_checked',
    authenticated: false,
    checks: [],
    result: 'not_verified',
}

function openSocket(address) {
    return new Promise((resolveOpen, rejectOpen) => {
        let socket
        try {
            socket = new WebSocket(address)
        } catch {
            rejectOpen(new Error('websocket_constructor_failed'))
            return
        }
        const timer = setTimeout(() => fail('websocket_open_timeout'), timeoutMs)
        function cleanup() {
            clearTimeout(timer)
            socket.removeEventListener('open', onOpen)
            socket.removeEventListener('error', onError)
            socket.removeEventListener('close', onClose)
        }
        function fail(reason) {
            cleanup()
            socket.close()
            rejectOpen(new Error(reason))
        }
        function onOpen() {
            cleanup()
            resolveOpen(socket)
        }
        function onError() { fail('websocket_connect_error') }
        function onClose() { fail('websocket_closed_before_open') }
        socket.addEventListener('open', onOpen)
        socket.addEventListener('error', onError)
        socket.addEventListener('close', onClose)
    })
}

function request(socket, event, data) {
    return new Promise((resolveRequest, rejectRequest) => {
        if (socket.readyState !== WebSocket.OPEN) {
            rejectRequest(new Error('socket_not_open'))
            return
        }
        const timer = setTimeout(() => settle(null, new Error(`timeout_${event}`)), timeoutMs)
        function settle(response, error) {
            clearTimeout(timer)
            socket.removeEventListener('message', onMessage)
            socket.removeEventListener('close', onClose)
            if (error) rejectRequest(error)
            else resolveRequest(response)
        }
        function onMessage(message) {
            let response
            try { response = JSON.parse(message.data) } catch { return }
            if (response?.event !== event) return
            settle(response)
        }
        function onClose() { settle(null, new Error('socket_closed_while_waiting')) }
        socket.addEventListener('message', onMessage)
        socket.addEventListener('close', onClose)
        try {
            socket.send(JSON.stringify({ action: 'onchat', data: { event, data } }))
        } catch {
            settle(null, new Error(`send_failed_${event}`))
        }
    })
}

function recordCheck(event, response, expected) {
    const valid = response?.status === 'success' && typeof response.data?.status === 'boolean'
    const passed = valid && (expected === undefined || response.data.status === expected)
    report.checks.push({
        event,
        status: response?.status === 'success' || response?.status === 'error' ? response.status : 'invalid',
        value: valid ? response.data.status : null,
        expected: expected ?? null,
        passed,
        receivedAt: new Date().toISOString(),
    })
    return passed
}

let socket
try {
    socket = await openSocket(url)
    report.transport = 'connected'
    if (probeOnly) {
        report.result = 'handshake_only_no_api_verification'
    } else {
        const login = await request(socket, 'LOGIN', { user: username, pass: password })
        report.authenticated = login?.status === 'success' && typeof login.data?.RE_LOGIN_CODE === 'string'
        if (!report.authenticated) throw new Error('login_not_confirmed')

        const exists = await request(socket, 'CHECK_USER_EXIST', { user: peer })
        const missingResult = await request(socket, 'CHECK_USER_EXIST', { user: missing })
        const online = await request(socket, 'CHECK_USER_ONLINE', { user: peer })
        const checks = [
            recordCheck('CHECK_USER_EXIST/existing', exists, true),
            recordCheck('CHECK_USER_EXIST/missing', missingResult, false),
            recordCheck('CHECK_USER_ONLINE', online),
        ]
        const success = checks.every(Boolean)
        report.result = success ? (isProduction ? 'live_checks_passed' : 'custom_endpoint_checks_passed') : 'live_checks_failed'
        if (!success) process.exitCode = 1
    }
} catch (error) {
    if (report.transport === 'not_checked') report.transport = 'failed'
    report.result = 'not_verified'
    report.error = error instanceof Error ? error.message : 'unknown_failure'
    process.exitCode = 1
} finally {
    if (socket && socket.readyState === WebSocket.OPEN) socket.close()
    writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'w' })
    console.log(JSON.stringify(report, null, 2))
    console.log(`Bằng chứng đã lưu: ${evidencePath}`)
}
