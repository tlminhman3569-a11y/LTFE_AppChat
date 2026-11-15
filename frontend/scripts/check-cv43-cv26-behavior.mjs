/** CV43 ↔ CV25 ↔ CV26 local behavior tests. Never claims real API verification. */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const folder = mkdtempSync(join(root, '.cv43-behavior-'))
let passed = 0
function check(title, fn) {
    fn()
    ++passed
    console.log(`PASS ${title}`)
}
function scan(dir) {
    return (awaitableReaddirSync(dir, { withFileTypes: true })).flatMap(item => {
        const name = join(dir, item.name)
        return item.isDirectory() ? scan(name) : item.isFile() && name.endsWith('.ts') ? [name] : []
    })
}
import { readdirSync as awaitableReaddirSync } from 'node:fs'
try {
    writeFileSync(join(folder, 'package.json'), '{"type":"module"}')
    for (const sourcePath of scan(join(root, 'src'))) {
        const rel = relative(join(root, 'src'), sourcePath)
        const output = join(folder, 'src', rel.replace(/\.ts$/, '.mjs'))
        mkdirSync(dirname(output), { recursive: true })
        const source = readFileSync(sourcePath, 'utf8').replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
            (_, before, target, after) => `${before}${target}.mjs${after}`)
        writeFileSync(output, ts.transpileModule(source, { fileName: sourcePath,
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
    }
    const imp = rel => import(pathToFileURL(join(folder, 'src', rel)).href)
    const { socketClient } = await imp('services/socketClient.mjs')
    const { checkExists } = await imp('services/usersApi.mjs')
    const { loadHistory, sendText, subscribeToMessages } = await imp('services/chatApi.mjs')
    const { default: reducer, messageReceived, markViewed, selectUnreadCount } = await imp('store/slices/messagesSlice.mjs')
    const { createConversationKey } = await imp('utils/conversationKey.mjs')

    const conversation = { kind: 'people', name: 'outside_fixture_01' }
    const key = createConversationKey(conversation)
    let state = reducer(undefined, { type: '@@init' })
    const m1 = { id: 7, kind: 'people', name: 'outside_fixture_01', to: 'tester', mes: 'Xin chao' }
    check('CV26 tin den tang unread cua dung chat', () => {
        state = reducer(state, messageReceived({ conversation, message: m1, viewed: false }))
        assert.equal(selectUnreadCount({ messages: state }, key), 1)
    })
    check('CV26 tin trung id khong tang unread', () => {
        state = reducer(state, messageReceived({ conversation, message: m1, viewed: false }))
        assert.equal(selectUnreadCount({ messages: state }, key), 1)
    })
    check('CV26 xem tin reset unread, khong xoa lich su', () => {
        state = reducer(state, markViewed(key))
        assert.equal(selectUnreadCount({ messages: state }, key), 0)
        assert.equal(state[key].messages.length, 1)
    })
    check('CV26 people va room trung ten co key rieng', () => {
        const room = { kind: 'room', name: 'outside_fixture_01' }
        state = reducer(state, messageReceived({ conversation: room,
            message: { ...m1, id: 8, kind: 'room', to: room.name }, viewed: false }))
        assert.equal(selectUnreadCount({ messages: state }, key), 0)
        assert.equal(selectUnreadCount({ messages: state }, createConversationKey(room)), 1)
    })
    const originalSend = socketClient.send
    const sent = []
    socketClient.send = text => sent.push(JSON.parse(text))
    check('CV26 sendText people gui SEND_CHAT qua socket chung', () => {
        sendText(conversation, 'Tin nhan thu')
        assert.deepEqual(sent.at(-1), { action: 'onchat', data: { event: 'SEND_CHAT',
            data: { type: 'people', to: conversation.name, mes: 'Tin nhan thu' } } })
    })
    check('CV26 sendText chan tin rong', () => {
        assert.throws(() => sendText(conversation, '  '))
    })
    socketClient.send = originalSend
    const originalSubscribe = socketClient.subscribe
    let listener
    socketClient.subscribe = (event, handler) => {
        assert.equal(event, 'SEND_CHAT')
        listener = handler
        return () => {}
    }
    const received = []
    let errors = 0
    const stop = subscribeToMessages('tester', (ref, msg) => received.push({ ref, msg }), () => errors++)
    check('CV26 listener dinh tuyen tin den people dung dich', () => {
        listener({ event: 'SEND_CHAT', status: 'success', data: { ...m1, type: 0 } })
        assert.equal(received.length, 1)
        assert.deepEqual(received[0].ref, conversation)
    })
    check('CV26 khong xem echo la ACK va bao loi rieng', () => {
        listener({ event: 'SEND_CHAT', status: 'success', data: { ...m1, name: 'tester', to: 'outside_fixture_01', type: 0 } })
        listener({ event: 'SEND_CHAT', status: 'error' })
        assert.equal(received.length, 1)
        assert.equal(errors, 1)
    })
    stop()
    socketClient.subscribe = originalSubscribe

    const NativeWS = globalThis.WebSocket
    let frame = null
    class FakeWebSocket {
        static OPEN = 1; static CONNECTING = 0; static CLOSED = 3; static CLOSING = 2
        readyState = 0
        constructor() { queueMicrotask(() => { this.readyState = 1; this.onopen?.() }) }
        send(data) {
            frame = JSON.parse(data)
            const evt = frame?.data?.event
            const answer = evt === 'CHECK_USER_EXIST'
                ? { status: 'success', event: evt, data: { status: frame.data.data.user === 'outside_fixture_01' } }
                : evt === 'GET_PEOPLE_CHAT_MES'
                    ? { status: 'success', event: evt, data: [{ ...m1, type: 0 }] }
                    : { status: 'error', event: evt }
            queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(answer) }))
        }
        close() { this.readyState = 3; queueMicrotask(() => this.onclose?.()) }
    }
    globalThis.WebSocket = FakeWebSocket
    try {
        await socketClient.connect('ws://local-test-not-real')
        check('CV43 ket noi gia lap de test giao thuc, KHONG PHAI API THAT', () => {
            assert.equal(socketClient.getStatus(), 'connected')
        })
        const existResult = await checkExists('outside_fixture_01')
        check('CV43 logical CHAT_CHECK_USER_EXIST -> wire CHECK_USER_EXIST theo Excel', () => {
            assert.equal(frame?.data?.event, 'CHECK_USER_EXIST')
            assert.deepEqual(existResult, { status: 'success', data: true })
        })
        const missingResult = await checkExists('outside_fixture_not_found')
        check('CV43 response false khong tao tai khoan gia', () => {
            assert.equal(frame?.data?.event, 'CHECK_USER_EXIST')
            assert.deepEqual(missingResult, { status: 'success', data: false })
        })
        const historyResult = await loadHistory(conversation, 1, 'tester')
        check('CV25/CV43 username ngoai fixture tai lich su page 1 dung nguoi', () => {
            assert.equal(frame?.data?.event, 'GET_PEOPLE_CHAT_MES')
            assert.deepEqual(frame.data.data, { name: conversation.name, page: 1 })
            assert.equal(historyResult.status, 'success')
            assert.equal(historyResult.data.messages.length, 1)
        })
    } finally {
        socketClient.disconnect()
        globalThis.WebSocket = NativeWS
    }
    console.log(`${passed}/${passed} behavioral checks passed (mock socket, not real server)`)
} finally {
    rmSync(folder, { recursive: true, force: true })
}
