import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function confirmLeave(response, room) {
    assertReply(response, 'OUT_ROOM')
    const data = response.data
    if (!data || typeof data !== 'object' || Array.isArray(data)
        || ('name' in data ? data.name !== room : !(typeof data.mes === 'string' && data.mes.trim()))) {
        throw new Error('unconfirmed_name_OUT_ROOM')
    }
}

export function inspectMembers(data, a, b) {
    const raw = 'userList' in data ? data.userList : 'user' in data ? data.user : data.members
    if (!Array.isArray(raw)) return { outcome: 'unverified', detail: 'member-list-missing-or-invalid' }
    const names = raw.map(x => typeof x === 'string' ? x : x?.name)
    if (names.some(x => typeof x !== 'string' || !x.trim())) return { outcome: 'unverified', detail: 'member-entry-invalid' }
    const hasA = names.includes(a), hasB = names.includes(b)
    const ownerMatches = (data.own ?? data.owner) === a
    return { outcome: hasA && hasB ? 'passed' : 'failed', detail: `count=${new Set(names).size};A=${hasA};B=${hasB};owner-is-A=${ownerMatches}` }
}

function assertReply(response, event, expectedStatus = 'success', expectedName) {
    if (response?.event !== event) throw new Error(`unexpected_event_${event}`)
    if (response.status !== expectedStatus) throw new Error(`unexpected_status_${event}`)
    if (expectedName !== undefined && response?.data?.name !== expectedName) {
        throw new Error(`unconfirmed_name_${event}`)
    }
}

async function main() {
    const live = process.argv.includes('--live')
    const url = process.env.CV49_WS_URL || 'wss://chat.longapp.io.vn/chat/chat'
    const evidenceFile = process.env.CV49_EVIDENCE_PATH || join(tmpdir(), 'cv49-live-evidence.json')
    const timeoutMs = 10_000
    const required = ['CV49_A_USER', 'CV49_A_PASS', 'CV49_B_USER', 'CV49_B_PASS']
    const record = {
        test: 'CV49', createdAt: new Date().toISOString(),
        node: process.version, mode: live ? 'live-authorized-only' : 'dry-run',
        endpoint: url === 'wss://chat.longapp.io.vn/chat/chat' ? 'teacher-production' : 'custom',
        result: 'not_run',
        tests: [],
        responses: [],
    }

    function note(name, outcome, detail = '') {
        record.tests.push({ name, outcome, ...(detail ? { detail } : {}) })
        console.log(`${outcome.toUpperCase()}: ${name}${detail ? ` (${detail})` : ''}`)
    }
    function openSocket(address) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(address)
            let finished = false
            const timer = setTimeout(() => fail('open_timeout'), timeoutMs)
            function cleanup() {
                clearTimeout(timer)
                ws.removeEventListener('open', onOpen)
                ws.removeEventListener('error', onError)
                ws.removeEventListener('close', onClose)
            }
            function fail(reason) {
                if (finished) return
                finished = true
                cleanup()
                ws.close()
                reject(new Error(reason))
            }
            function onOpen() {
                if (finished) return
                finished = true
                cleanup()
                resolve(ws)
            }
            function onError() { fail('connect_error') }
            function onClose() { fail('closed_before_open') }
            ws.addEventListener('open', onOpen)
            ws.addEventListener('error', onError)
            ws.addEventListener('close', onClose)
        })
    }
    function request(ws, event, data) {
        return new Promise((resolve, reject) => {
            if (ws.readyState !== WebSocket.OPEN) return reject(new Error('not_connected'))
            let settled = false
            const timer = setTimeout(() => finish(null, new Error(`timeout_${event}`)), timeoutMs)
            function finish(result, error) {
                if (settled) return
                settled = true
                clearTimeout(timer)
                ws.removeEventListener('message', onMessage)
                ws.removeEventListener('close', onClose)
                if (error) {
                    if (ws.readyState === WebSocket.OPEN) ws.close()
                    reject(error)
                } else resolve(result)
            }
            function onMessage(message) {
                if (typeof message.data !== 'string') return
                let response
                try { response = JSON.parse(message.data) } catch { return }
                if (response?.event === event) {
                    const payload = response.data
                    record.responses.push({ event, status: ['success', 'error'].includes(response.status) ? response.status : 'unknown',
                        ...(data?.name !== undefined ? { namePresent: !!payload && typeof payload === 'object' && 'name' in payload, nameMatches: payload?.name === data.name } : {}),
                        mesPresent: typeof payload?.mes === 'string' && !!payload.mes.trim() })
                    finish(response)
                }
            }
            function onClose() { finish(null, new Error(`closed_${event}`)) }
            ws.addEventListener('message', onMessage)
            ws.addEventListener('close', onClose)
            try { ws.send(JSON.stringify({ action: 'onchat', data: { event, data } })) }
            catch { finish(null, new Error(`send_failed_${event}`)) }
        })
    }
    function redactFailure(error) {
        const message = error instanceof Error ? error.message : ''
        const safe = /^(open_timeout|connect_error|closed_before_open|not_connected|timeout_[A-Z_]+|closed_[A-Z_]+|send_failed_[A-Z_]+|unexpected_event_[A-Z_]+|unexpected_status_[A-Z_]+|unconfirmed_name_[A-Z_]+|login_unconfirmed|invalid_test_config|room_history_missing)$/.test(message)
        return safe ? message : 'unexpected_error'
    }

    const a = { username: process.env.CV49_A_USER, password: process.env.CV49_A_PASS }
    const b = { username: process.env.CV49_B_USER, password: process.env.CV49_B_PASS }
    const missing = `cv49_absent_${randomBytes(6).toString('hex')}`
    const room = `cv49_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
    const sockets = []
    try {
        if (!live) {
            console.log('DRY-RUN: Không kết nối máy chủ. Dùng --live và biến môi trường CV49_ALLOW_WRITES=YES nếu đã có hai tài khoản/phòng thử được phép.')
            note('live-server', 'skipped', 'missing --live')
        } else {
            if (process.env.CV49_ALLOW_WRITES !== 'YES'
                || required.some(key => !process.env[key])
                || a.username.toLowerCase() === b.username.toLowerCase()
                || !(/^(wss:\/\/|ws:\/\/localhost(?::\d+)?\/)/).test(url)) {
                throw new Error('invalid_test_config')
            }
            console.log('LIVE: Chỉ dùng hai tài khoản được phép. Script sẽ tạo MỘT phòng thử không thể xóa tự động.')
            const wsA = await openSocket(url); sockets.push(wsA)
            const wsB = await openSocket(url); sockets.push(wsB)
            for (const [label, ws, credentials] of [['A', wsA, a], ['B', wsB, b]]) {
                const response = await request(ws, 'LOGIN', { user: credentials.username, pass: credentials.password })
                if (response?.status !== 'success' || typeof response?.data?.RE_LOGIN_CODE !== 'string') throw new Error('login_unconfirmed')
                note(`login-${label}`, 'passed')
            }
            for (const [label, ws] of [['A', wsA], ['B', wsB]]) {
                assertReply(await request(ws, 'GET_USER_LIST', {}), 'GET_USER_LIST')
                note(`recent-list-${label}`, 'passed', 'Gợi ý chỉ từ dữ liệu gần đây; không chứng minh quyền phòng')
            }
            const existing = await request(wsA, 'CHECK_USER_EXIST', { user: b.username })
            assertReply(existing, 'CHECK_USER_EXIST')
            if (existing.data?.status !== true) throw new Error('unexpected_status_CHECK_USER_EXIST')
            note('lookup-existing-user', 'passed')
            const absent = await request(wsA, 'CHECK_USER_EXIST', { user: missing })
            assertReply(absent, 'CHECK_USER_EXIST')
            if (absent.data?.status !== false) throw new Error('unexpected_status_CHECK_USER_EXIST')
            note('lookup-missing-user', 'passed')

            const absentJoin = await request(wsB, 'JOIN_ROOM', { name: missing })
            assertReply(absentJoin, 'JOIN_ROOM', 'error')
            note('join-nonexistent-room', 'passed')
            assertReply(await request(wsA, 'CREATE_ROOM', { name: room }), 'CREATE_ROOM', 'success', room)
            note('create-room', 'passed')
            assertReply(await request(wsA, 'CREATE_ROOM', { name: room }), 'CREATE_ROOM', 'error')
            note('duplicate-room', 'passed')
            assertReply(await request(wsB, 'JOIN_ROOM', { name: room }), 'JOIN_ROOM', 'success', room)
            note('join-room', 'passed')
            const alreadyMember = await request(wsB, 'JOIN_ROOM', { name: room })
            if (alreadyMember?.event !== 'JOIN_ROOM' || !['success', 'error'].includes(alreadyMember?.status)) {
                throw new Error('unexpected_status_JOIN_ROOM')
            }
            if (alreadyMember.status === 'success' && alreadyMember?.data?.name !== room) {
                throw new Error('unconfirmed_name_JOIN_ROOM')
            }
            note('join-already-member', 'observed', alreadyMember.status === 'success' ? 'server-idempotent-success' : 'server-rejected')
            for (const [label, ws] of [['A', wsA], ['B', wsB]]) {
                const read = await request(ws, 'GET_ROOM_CHAT_MES', { name: room, page: 1 })
                assertReply(read, 'GET_ROOM_CHAT_MES', 'success', room)
                if (!Array.isArray(read?.data?.chatData) && !Array.isArray(read?.data?.chatMess)) throw new Error('room_history_missing')
                const members = inspectMembers(read.data, a.username, b.username)
                note(`member-list-${label}`, members.outcome, members.detail)
                note(`load-room-${label}`, 'passed', [
                    'own' in read.data || 'owner' in read.data ? 'owner-field-present' : 'owner-unknown',
                    'userList' in read.data || 'user' in read.data || 'members' in read.data ? 'members-field-present' : 'members-unknown',
                ].join(';'))
            }
            confirmLeave(await request(wsB, 'OUT_ROOM', { name: room }), room)
            note('leave-as-member', 'passed')
            assertReply(await request(wsB, 'JOIN_ROOM', { name: room }), 'JOIN_ROOM', 'success', room)
            note('rejoin-after-leave', 'passed')
            confirmLeave(await request(wsB, 'OUT_ROOM', { name: room }), room)
            note('leave-after-rejoin', 'passed')
            note('owner-cannot-leave-UI', 'skipped', 'Kiểm tra thủ công; không thử OUT_ROOM bằng chủ phòng')
            note('timeout-UI', 'skipped', 'Đã phủ trong check-cv49.mjs; không ép timeout trên máy chủ thật')
            note('cancel-with-draft-UI', 'skipped', 'Requires real UI and zero OUT_ROOM requests')
            record.result = record.tests.some(t => ['failed', 'unverified'].includes(t.outcome))
                ? 'live_checks_incomplete_or_failed' : 'live_api_checks_passed_ui_pending'
            if (record.result === 'live_checks_incomplete_or_failed') process.exitCode = 1
        }
    } catch (error) {
        record.result = live ? 'not_verified_or_failed' : 'not_run'
        record.failure = redactFailure(error)
        note('stopped', 'failed', record.failure)
        process.exitCode = 1
    } finally {
        for (const ws of sockets) if (ws.readyState !== WebSocket.CLOSED) ws.close()
        writeFileSync(evidenceFile, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
        console.log(`Sanitized evidence: ${evidenceFile}`)
        console.log(`Result: ${record.result}; ${record.tests.length} recorded steps`)
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
