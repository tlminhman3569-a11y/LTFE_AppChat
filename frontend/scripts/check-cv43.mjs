import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const temp = mkdtempSync(join(tmpdir(), 'cv43-test-'))
let passed = 0
let expected = 0

function read(path) {
    return readFileSync(join(root, path), 'utf8')
}

async function check(name, run) {
    expected += 1
    await run()
    passed += 1
    console.log(`PASS ${name}`)
}

function copyTs(path) {
    const source = read(path).replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (all, first, file, last) => {
        return `${first}${file}.ts${last}`
    })
    const output = join(temp, path.replace(/^src\//, ''))
    mkdirSync(resolve(output, '..'), { recursive: true })
    writeFileSync(output, source)
}

const paths = [
    'src/services/usersApi.ts',
    'src/services/socketClient.ts',
    'src/utils/parseUserChecks.ts',
    'src/utils/normalizeRecentConversations.ts',
]

try {
    writeFileSync(join(temp, 'package.json'), '{"type":"module"}')
    for (const path of paths) copyTs(path)

    const parser = await import(pathToFileURL(join(temp, 'utils/parseUserChecks.ts')).href)
    const service = await import(pathToFileURL(join(temp, 'services/usersApi.ts')).href)
    const { socketClient, SocketRequestError } = await import(pathToFileURL(join(temp, 'services/socketClient.ts')).href)

    const existsResponse = data => ({ event: 'CHECK_USER_EXIST', status: 'success', data })
    const onlineResponse = data => ({ event: 'CHECK_USER_ONLINE', status: 'success', data })

    await check('F09: true xac nhan tai khoan ton tai', () => {
        assert.deepEqual(parser.parseUserExists(existsResponse(true)), { status: 'success', data: true })
    })
    await check('F09: false xac nhan khong ton tai', () => {
        assert.deepEqual(parser.parseUserExists(existsResponse(false)), { status: 'success', data: false })
    })
    await check('F09: object exists true duoc doc', () => {
        assert.deepEqual(parser.parseUserExists(existsResponse({ exists: true })), { status: 'success', data: true })
    })
    await check('F09: object exists false duoc doc', () => {
        assert.deepEqual(parser.parseUserExists(existsResponse({ exists: false })), { status: 'success', data: false })
    })
    await check('F09: isExist la co boolean ro rang', () => {
        assert.equal(parser.parseUserExists(existsResponse({ isExist: true })).data, true)
    })
    await check('F09: so 0 la false', () => {
        assert.equal(parser.parseUserExists(existsResponse(0)).data, false)
    })
    await check('F09: so 1 la true', () => {
        assert.equal(parser.parseUserExists(existsResponse(1)).data, true)
    })
    await check('F09: chuoi false la false', () => {
        assert.equal(parser.parseUserExists(existsResponse('false')).data, false)
    })
    await check('F09: khong co flag ro rang la parse error', () => {
        assert.equal(parser.parseUserExists(existsResponse({ username: 'demo' })).status, 'error')
    })
    await check('F09: thieu data khong duoc coi la ton tai', () => {
        assert.equal(parser.parseUserExists({ event: 'CHECK_USER_EXIST', status: 'success' }).status, 'error')
    })
    await check('F09: phan hoi sai event bi tu choi', () => {
        assert.equal(parser.parseUserExists({ event: 'LOGIN', status: 'success', data: true }).status, 'error')
    })
    await check('F09: server error khong phai false', () => {
        const result = parser.parseUserExists({ event: 'CHECK_USER_EXIST', status: 'error', data: false })
        assert.equal(result.status, 'error')
        assert.equal(result.error.kind, 'business')
    })
    await check('F09: thieu status bi tu choi', () => {
        assert.equal(parser.parseUserExists({ event: 'CHECK_USER_EXIST', data: true }).status, 'error')
    })

    const checkedAt = '2026-11-13T13:00:00.000Z'
    await check('Online: true -> online', () => {
        assert.deepEqual(parser.parseUserOnline(onlineResponse(true), checkedAt), { status: 'success', data: { status: 'online', checkedAt } })
    })
    await check('Online: false -> offline', () => {
        assert.equal(parser.parseUserOnline(onlineResponse(false), checkedAt).data.status, 'offline')
    })
    await check('Online: data.online true', () => {
        assert.equal(parser.parseUserOnline(onlineResponse({ online: true }), checkedAt).data.status, 'online')
    })
    await check('Online: data.isOnline false', () => {
        assert.equal(parser.parseUserOnline(onlineResponse({ isOnline: false }), checkedAt).data.status, 'offline')
    })
    await check('Online: data.status offline', () => {
        assert.equal(parser.parseUserOnline(onlineResponse({ status: 'offline' }), checkedAt).data.status, 'offline')
    })
    await check('Online: data.status online', () => {
        assert.equal(parser.parseUserOnline(onlineResponse({ status: 'online' }), checkedAt).data.status, 'online')
    })
    await check('Online: so 0 la offline', () => {
        assert.equal(parser.parseUserOnline(onlineResponse(0), checkedAt).data.status, 'offline')
    })
    await check('Online: thieu du lieu khong tu nhan offline', () => {
        assert.equal(parser.parseUserOnline({ event: 'CHECK_USER_ONLINE', status: 'success' }, checkedAt).status, 'error')
    })
    await check('Online: event sai bi tu choi', () => {
        assert.equal(parser.parseUserOnline({ event: 'CHECK_USER_EXIST', status: 'success', data: true }, checkedAt).status, 'error')
    })
    await check('Online: server error khong thanh offline', () => {
        assert.equal(parser.parseUserOnline({ event: 'CHECK_USER_ONLINE', status: 'error' }, checkedAt).status, 'error')
    })

    let calls = []
    let reply = null
    socketClient.request = async (event, data) => {
        calls.push({ event, data })
        if (reply instanceof Error) throw reply
        return reply
    }

    reply = existsResponse(true)
    await check('API: checkExists gui dung CHAT_CHECK_USER_EXIST', async () => {
        calls = []
        assert.deepEqual(await service.checkExists('minh_an'), { status: 'success', data: true })
        assert.deepEqual(calls, [{ event: 'CHAT_CHECK_USER_EXIST', data: { user: 'minh_an' } }])
    })
    await check('API: ten duoc trim, khong lower-case', async () => {
        calls = []
        await service.checkExists('  Minh_An  ')
        assert.deepEqual(calls, [{ event: 'CHAT_CHECK_USER_EXIST', data: { user: 'Minh_An' } }])
    })
    await check('API: user rong khong gui request', async () => {
        calls = []
        assert.equal((await service.checkExists('  ')).status, 'error')
        assert.equal(calls.length, 0)
    })
    await check('API: user khong ton tai khong tra user gia', async () => {
        reply = existsResponse(false)
        const result = await service.checkExists('khong_co')
        assert.deepEqual(result, { status: 'success', data: false })
    })
    await check('API: timeout tra unknown', async () => {
        reply = new SocketRequestError('time out', 'timeout', true)
        const result = await service.checkExists('ban_mau')
        assert.equal(result.status, 'unknown')
    })
    await check('API: mat ket noi tra error', async () => {
        reply = new SocketRequestError('lost', 'connection', false)
        const result = await service.checkExists('ban_mau')
        assert.equal(result.status, 'error')
        assert.equal(result.error.kind, 'connection')
    })
    await check('API: checkOnline gui dung CHAT_CHECK_USER_ONLINE', async () => {
        calls = []
        reply = onlineResponse({ isOnline: true })
        const result = await service.checkOnline('ban_mau')
        assert.equal(result.status, 'success')
        assert.equal(result.data.status, 'online')
        assert.match(result.data.checkedAt, /^\d{4}-\d{2}-\d{2}T/)
        assert.deepEqual(calls, [{ event: 'CHAT_CHECK_USER_ONLINE', data: { user: 'ban_mau' } }])
    })
    await check('API: checkOnline loi khong gia offline', async () => {
        calls = []
        reply = new SocketRequestError('lost', 'connection', false)
        assert.equal((await service.checkOnline('ban_mau')).status, 'error')
    })
    await check('API: khong checkOnline khi user rong', async () => {
        calls = []
        assert.equal((await service.checkOnline(' ')).status, 'error')
        assert.equal(calls.length, 0)
    })
    await check('API: GET_USER_LIST van hoat dong', async () => {
        calls = []
        reply = { event: 'GET_USER_LIST', status: 'success', data: [{ name: 'a', type: 0 }, { name: 'room', type: 1 }] }
        const result = await service.getRecentConversations()
        assert.equal(result.status, 'success')
        assert.deepEqual(result.data.map(item => item.kind), ['people', 'room'])
        assert.deepEqual(calls, [{ event: 'GET_USER_LIST', data: {} }])
    })

    const sourceApi = read('src/services/usersApi.ts')
    const socket = read('src/services/socketClient.ts')
    const checkUser = read('src/features/users/CheckUser.tsx')
    const sidebar = read('src/components/ConversationSidebar.tsx')
    const presence = read('src/store/slices/presenceSlice.ts')
    const appStore = read('src/store/index.ts')

    await check('Transport: CHECK_USER_EXIST dung event reply', () => {
        assert.match(socket, /'CHAT_CHECK_USER_EXIST'\) responseEvent = 'CHECK_USER_EXIST'/)
    })
    await check('Transport: CHECK_USER_ONLINE dung event reply', () => {
        assert.match(socket, /'CHAT_CHECK_USER_ONLINE'\) responseEvent = 'CHECK_USER_ONLINE'/)
    })
    await check('F09: chi submit moi gui checkExists', () => {
        assert.match(checkUser, /<form onSubmit=\{handleCheck\}/)
        assert.match(checkUser, /result = await checkExists\(user\)/)
        assert.doesNotMatch(checkUser.slice(checkUser.indexOf('useEffect('), checkUser.indexOf('async function handleCheck')), /checkExists/)
    })
    await check('F09: tai khoan cua minh khong gui', () => {
        assert.match(checkUser, /if \(user === currentUser\)/)
        assert.match(checkUser, /setStatus\('self'\)/)
    })
    await check('F09: chi ton tai moi mo chat people', () => {
        assert.match(checkUser, /if \(result\.data === true\)/)
        assert.match(checkUser, /onSelectConversation\(\{ kind: 'people', name: user \}\)/)
    })
    await check('F09: khong tu them vao GET_USER_LIST', () => {
        assert.doesNotMatch(checkUser, /dispatch\(refreshConversations|JOIN_ROOM|addRecent/)
    })
    await check('F09: pending khoa submit', () => {
        assert.match(checkUser, /disabled=\{status === 'checking'\}/)
        assert.match(checkUser, /if \(pending\.current\) return/)
    })
    await check('F09: phan hoi phien cu bi bo qua', () => {
        assert.match(checkUser, /store\.getState\(\)\.auth\.sessionGeneration !== sessionGeneration/)
    })
    await check('F09: name doi moi reset trang thai form', () => {
        assert.match(sidebar, /key=\{JSON\.stringify\(\[sessionGeneration, query\]\)\}/)
    })
    await check('F09: nut Kiem tra gan trong sidebar', () => {
        assert.match(sidebar, /<CheckUser/)
        assert.match(checkUser, /Kiểm tra người dùng/)
    })
    await check('F09: khong gui kiem tra tren fixture', () => {
        assert.match(sidebar, /!isMock && \(filter === 'people' \|\| conversations\.length === 0\)/)
    })
    await check('Presence: chi tao request luc chon people', () => {
        assert.match(sidebar, /conversation\.kind === 'people'/)
        assert.match(sidebar, /dispatch\(refreshPresence\(\{ user: conversation\.name, sessionGeneration \}\)\)/)
    })
    await check('Presence: selector theo username', () => {
        assert.match(presence, /byUser: Record<string, UserPresence>/)
    })
    await check('Presence: phien thay doi phai xoa du lieu', () => {
        assert.match(presence, /\.addCase\(sessionCleared, emptyPresence\)/)
        assert.match(presence, /\.addCase\(sessionStarted, emptyPresence\)/)
    })
    await check('Presence: phan hoi phien cu khong ghi de', () => {
        assert.match(presence, /state\.sessionGeneration !== sessionGeneration \|\| state\.requestIds\[user\] !== action\.meta\.requestId/)
    })
    await check('Presence: loi la unknown va co checkedAt', () => {
        assert.match(presence, /\{ status: 'unknown', checkedAt \}/)
    })
    await check('Presence: Kiệt co selector theo username', () => {
        assert.match(presence, /export function selectUserPresence/)
        assert.match(presence, /return state\.presence\.byUser\[user\] \?\? \{ status: 'unknown' \}/)
    })
    await check('Presence: dang ky trong Redux store', () => {
        assert.match(appStore, /presence: presenceReducer/)
    })
    await check('API: khong co REST hoac socket moi', () => {
        assert.doesNotMatch(sourceApi, /new WebSocket|fetch\(|axios/)
        assert.match(sourceApi, /socketClient\.request/)
    })

    console.log(`${passed}/${expected} checks passed`)
    console.log(`Node.js ${process.version}`)
} finally {
    rmSync(temp, { recursive: true, force: true })
}
