import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = new URL('../src/', import.meta.url)
const source = readFileSync(new URL('features/auth/reconnectSession.ts', root), 'utf8')
const layout = readFileSync(new URL('components/ChatLayout.tsx', root), 'utf8')
const page = readFileSync(new URL('features/chat/ChatPage.tsx', root), 'utf8')
const hook = readFileSync(new URL('hooks/useSocket.ts', root), 'utf8')
const temp = mkdtempSync(join(tmpdir(), 'cv43-cv09-flow-'))
const compiled = source.replace(/^import .*\r?\n/gm, '')
const intro = `const { reLogin, clearStoredSession, readStoredSession, socketClient, store, connectionStatusChanged, sessionCleared, sessionReconnected } = globalThis.__cv43Mocks\n`
writeFileSync(join(temp, 'reconnectSession.ts'), intro + compiled)

let passed = 0
function test(name, check) {
    check()
    passed++
    console.log('PASS', name)
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function setup() {
    const auth = {
        authStatus: 'authenticated', connectionStatus: 'connected', currentUser: 'tai_khoan_thu',
        sessionGeneration: 7, reconnectCount: 0,
    }
    const session = { username: 'tai_khoan_thu', reLoginCode: 'ma_phien_an' }
    const subs = new Set()
    const conversation = { kind: 'people', name: 'ngoai_fixture' }
    const draft = 'noi dung nhap khong ghi vao log'
    const key = JSON.stringify([conversation.kind, conversation.name])
    let historyKey = JSON.stringify([auth.sessionGeneration, key, auth.reconnectCount])
    let historyReloads = 0
    let reLoginCalls = 0
    let inFlight = 0
    let peakConcurrent = 0
    let resolver = null
    let responseMode = 'deferred'
    let onStatus = () => {}
    let socketStatus = 'connected'
    let cleared = false
    const store = {
        getState() { return { auth: { ...auth } } },
        subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
        dispatch(action) {
            if (action.type === 'status') auth.connectionStatus = action.payload
            else if (action.type === 'reconnected') { auth.connectionStatus = 'connected'; auth.reconnectCount++ }
            else if (action.type === 'cleared') { auth.authStatus = 'unauthenticated'; auth.sessionGeneration++ }
            for (const fn of subs) fn()
        },
    }
    const unsubscribe = store.subscribe(() => {
        const nextKey = JSON.stringify([auth.sessionGeneration, key, auth.reconnectCount])
        if (nextKey === historyKey) return
        historyKey = nextKey
        historyReloads++
    })
    const socketClient = {
        subscribeStatus(fn) { onStatus = fn; fn('connected'); return () => { onStatus = () => {} } },
        getStatus() { return socketStatus },
        disconnect() { socketStatus = 'disconnected'; onStatus('disconnected') },
        clearSessionListeners() {},
    }
    async function reLogin() {
        reLoginCalls++
        inFlight++
        peakConcurrent = Math.max(peakConcurrent, inFlight)
        try {
            if (responseMode === 'failure') {
                return { status: 'error', error: { kind: 'connection', message: 'Mat mang' } }
            }
            return await new Promise(resolve => { resolver = resolve })
        } finally { inFlight-- }
    }
    globalThis.__cv43Mocks = {
        reLogin,
        clearStoredSession() { cleared = true },
        readStoredSession() { return session },
        socketClient, store,
        connectionStatusChanged(payload) { return { type: 'status', payload } },
        sessionCleared(payload) { return { type: 'cleared', payload } },
        sessionReconnected() { return { type: 'reconnected' } },
    }
    return {
        auth, conversation, draft, store, socketClient, unsubscribe,
        get reloads() { return historyReloads },
        get calls() { return reLoginCalls },
        get concurrent() { return peakConcurrent },
        get cleared() { return cleared },
        setMode(value) { responseMode = value },
        goOffline() { socketStatus = 'disconnected'; onStatus('disconnected') },
        openSocket() { socketStatus = 'connected'; onStatus('connected') },
        resolveSuccess() {
            assert.ok(resolver, 'Chua co RE_LOGIN dang cho')
            resolver({ status: 'success', data: { ...session, reLoginCode: 'ma_phien_moi' } })
        },
    }
}

try {
    const moduleUrl = pathToFileURL(join(temp, 'reconnectSession.ts')).href
    test('ChatLayout dung retrySocketConnection rieng cua CV09', () => {
        assert.match(layout, /import \{ retrySocketConnection \} from '\.\.\/features\/auth\/reconnectSession'/)
        assert.match(layout, /onClick=\{retrySocketConnection\}/)
        assert.doesNotMatch(layout, /\breLogin\(|\bsetReconnectCount\(/)
    })
    test('useSocket chi cung cap reconnectCount cua Redux', () => {
        assert.match(hook, /reconnectCount/)
        assert.match(layout, /\{ connectionStatus, reconnectCount, canUseSocket \} = useSocket\(\)/)
    })
    test('Khoa ChatHistory co reconnectCount, Composer khong bi remount', () => {
        assert.match(page, /key=\{JSON\.stringify\(\[sessionGeneration, conversationKey, reconnectCount\]\)\}/)
        assert.match(page, /<Composer\s[\s\S]*?key=\{conversationKey\}/)
        assert.doesNotMatch(page.match(/<Composer\s[\s\S]*?\/>/)?.[0] || '', /reconnectCount/)
    })
    test('CV24 chi tai API that cho chat people', () => {
        assert.match(layout, /usingMockData \|\| conversation\.kind === 'room'/)
        assert.match(layout, /return loadChatHistory\(conversation, page, user\)/)
    })

    const auto = setup()
    const mod = await import(moduleUrl)
    let stop = mod.watchSocketConnection()
    try {
        auto.goOffline()
        test('AUTO: mat ket noi chua tai lai lich su', () => {
            assert.equal(auto.auth.connectionStatus, 'reconnecting')
            assert.equal(auto.reloads, 0)
        })
        await delay(580)
        test('AUTO: dang cho RE_LOGIN van chua tai lai', () => {
            assert.equal(auto.calls, 1)
            assert.equal(auto.reloads, 0)
            assert.equal(auto.auth.reconnectCount, 0)
        })
        mod.retrySocketConnection()
        mod.retrySocketConnection()
        test('AUTO: nut retry khong tao RE_LOGIN thu hai', () => {
            assert.equal(auto.calls, 1)
            assert.equal(auto.concurrent, 1)
        })
        auto.openSocket()
        test('AUTO: socket da mo nhung RE_LOGIN chua success thi khong tai lai', () => {
            assert.equal(auto.reloads, 0)
            assert.equal(auto.auth.connectionStatus, 'reconnecting')
        })
        auto.resolveSuccess()
        await delay(30)
        test('AUTO: thanh cong moi tang reconnectCount va tai lich su mot lan', () => {
            assert.equal(auto.auth.reconnectCount, 1)
            assert.equal(auto.reloads, 1)
            assert.equal(auto.auth.connectionStatus, 'connected')
        })
        test('AUTO: khong doi user, hoi thoai va ban nhap', () => {
            assert.equal(auto.auth.currentUser, 'tai_khoan_thu')
            assert.deepEqual(auto.conversation, { kind: 'people', name: 'ngoai_fixture' })
            assert.equal(auto.draft, 'noi dung nhap khong ghi vao log')
        })
    } finally { stop(); auto.unsubscribe() }

    const manual = setup()
    manual.setMode('failure')
    const modManual = await import(moduleUrl + '?scenario=manual')
    stop = modManual.watchSocketConnection()
    try {
        manual.goOffline()
        await delay(3850)
        test('MANUAL: ba lan auto khong thanh cong, khong tai lai lich su', () => {
            assert.equal(manual.calls, 3)
            assert.equal(manual.auth.connectionStatus, 'disconnected')
            assert.equal(manual.auth.reconnectCount, 0)
            assert.equal(manual.reloads, 0)
        })
        manual.setMode('deferred')
        modManual.retrySocketConnection()
        modManual.retrySocketConnection()
        await delay(580)
        test('MANUAL: hai lan nhan chi sinh mot lan RE_LOGIN moi', () => {
            assert.equal(manual.calls, 4)
            assert.equal(manual.concurrent, 1)
            assert.equal(manual.reloads, 0)
        })
        manual.openSocket()
        test('MANUAL: ket noi WebSocket chua du de tai lai lich su', () => {
            assert.equal(manual.auth.connectionStatus, 'reconnecting')
            assert.equal(manual.reloads, 0)
        })
        manual.resolveSuccess()
        await delay(30)
        test('MANUAL: RE_LOGIN success moi tai lai lich su', () => {
            assert.equal(manual.auth.connectionStatus, 'connected')
            assert.equal(manual.auth.reconnectCount, 1)
            assert.equal(manual.reloads, 1)
        })
        test('MANUAL: giu nguyen tai khoan, hoi thoai va ban nhap', () => {
            assert.equal(manual.auth.currentUser, 'tai_khoan_thu')
            assert.deepEqual(manual.conversation, { kind: 'people', name: 'ngoai_fixture' })
            assert.equal(manual.draft, 'noi dung nhap khong ghi vao log')
        })
    } finally { stop(); manual.unsubscribe() }

    console.log(`${passed} mock integration checks PASS`)
    console.log(`Node.js ${process.version}`)
    console.log('Kiem thu state machine CV09 va hop dong UI; CHUA phai ket qua browser hay server API that.')
} finally {
    delete globalThis.__cv43Mocks
    rmSync(temp, { recursive: true, force: true })
}