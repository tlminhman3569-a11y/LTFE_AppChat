import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const toolkit = require('@reduxjs/toolkit')

function compile(relativePath, imports) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const module = { exports: {} }
    runInNewContext(output, {
        module,
        exports: module.exports,
        require: name => {
            if (name.endsWith('.css')) return {}
            assert.ok(name in imports, `Unexpected import ${name}`)
            return imports[name]
        },
        Date,
    })
    return module.exports
}

const calls = []
let reply = async () => ({})
class SocketRequestError extends Error {
    constructor(kind, wasSent) {
        super(kind)
        this.kind = kind
        this.wasSent = wasSent
    }
}

const roomsApi = compile('../src/services/roomsApi.ts', {
    './socketClient': {
        SocketRequestError,
        socketClient: {
            request: async (event, data) => {
                calls.push({ event, data })
                return reply()
            },
        },
    },
})

let total = 0
async function check(name, test) {
    calls.length = 0
    await test()
    console.log(`PASS CV45-${String(++total).padStart(2, '0')} ${name}`)
}

function response(data, status = 'success', event = 'GET_ROOM_CHAT_MES') {
    reply = async () => ({ event, status, data })
}

const message = { id: 12, name: 'Kiet', to: 'Nhom_Hoc', type: 1, mes: 'Chào bạn', createAt: '2026-11-13T10:00:00' }

await check('GET_ROOM_CHAT_MES giữ nguyên tên, trang và chuẩn hóa tin', async () => {
    response({ name: 'Nhom_Hoc', own: 'Khoi', userList: [{ name: 'Khoi' }, 'Kiet'], chatData: [message] })
    const result = await roomsApi.loadRoom('Nhom_Hoc', 1)
    assert.equal(result.status, 'success')
    assert.equal(JSON.stringify(calls), JSON.stringify([{ event: 'GET_ROOM_CHAT_MES', data: { name: 'Nhom_Hoc', page: 1 } }]))
    assert.equal(result.data.messages[0].kind, 'room')
    assert.equal(result.data.messages[0].id, 12)
    assert.deepEqual(Array.from(result.data.members), ['Khoi', 'Kiet'])
    assert.equal(result.data.owner, 'Khoi')
    assert.equal(result.data.membership, 'unknown')
})
await check('Thiếu metadata không bị suy thành rỗng', async () => {
    response({ name: 'Nhom_Hoc', chatData: [] })
    const result = await roomsApi.loadRoom('Nhom_Hoc', 2)
    assert.equal(result.status, 'success')
    assert.equal(result.data.membersKnown, false)
    assert.equal(result.data.ownerKnown, false)
    assert.equal('members' in result.data, false)
})
await check('Mảng rỗng có xác nhận thành viên trống', async () => {
    response({ name: 'Nhom_Hoc', chatData: [], userList: [] })
    const result = await roomsApi.loadRoom('Nhom_Hoc', 1)
    assert.equal(result.status, 'success')
    assert.equal(result.data.membersKnown, true)
    assert.deepEqual(Array.from(result.data.members), [])
})
await check('Biến thể chatMess/user/owner và loại trùng thành viên', async () => {
    response({ name: 'Nhom_Hoc', chatMess: [], user: ['Khoi', 'Khoi'], owner: 'Khoi' })
    const result = await roomsApi.loadRoom('Nhom_Hoc', 1)
    assert.equal(result.status, 'success')
    assert.equal(result.data.owner, 'Khoi')
    assert.deepEqual(Array.from(result.data.members), ['Khoi'])
})
await check('Thiếu hoặc sai mảng lịch sử không giả thành 0 tin', async () => {
    for (const data of [{ name: 'Nhom_Hoc' }, { name: 'Nhom_Hoc', chatData: {} }]) {
        response(data)
        assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 1)).error.kind, 'parse')
    }
})
await check('Thành viên sai kiểu không biến thành mảng rỗng', async () => {
    response({ name: 'Nhom_Hoc', chatData: [], userList: [{ id: 1 }] })
    assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 1)).error.kind, 'parse')
})
await check('Tin sai loại, sai phòng và trường thiếu bị từ chối', async () => {
    for (const bad of [{ ...message, type: 0 }, { ...message, to: 'roomKhac' }, { ...message, mes: null }]) {
        response({ name: 'Nhom_Hoc', chatData: [bad] })
        assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 1)).error.kind, 'parse')
    }
})
await check('Tên phòng và trang trả về phải khớp', async () => {
    response({ name: 'Khac', chatData: [] })
    assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 1)).error.kind, 'parse')
    response({ name: 'Nhom_Hoc', page: 2, chatData: [] })
    assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 1)).error.kind, 'parse')
})
await check('Sai event và status đều là lỗi parse khi đọc', async () => {
    response({ name: 'Nhom_Hoc', chatData: [] }, 'success', 'JOIN_ROOM')
    assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 1)).error.kind, 'parse')
    response({ name: 'Nhom_Hoc', chatData: [] }, 'pending')
    assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 1)).error.kind, 'parse')
})
await check('Lỗi nghiệp vụ và timeout cho phép đọc lại', async () => {
    reply = async () => ({ event: 'GET_ROOM_CHAT_MES', status: 'error', mes: 'Room unavailable' })
    const business = await roomsApi.loadRoom('Nhom_Hoc', 1)
    assert.equal(business.status, 'error')
    assert.equal(business.error.kind, 'business')
    reply = async () => { throw new SocketRequestError('timeout', true) }
    const timeout = await roomsApi.loadRoom('Nhom_Hoc', 1)
    assert.equal(timeout.status, 'error')
    assert.equal(timeout.error.kind, 'timeout')
})
await check('Không gửi request nếu thiếu tên hoặc sai page', async () => {
    assert.equal((await roomsApi.loadRoom('', 1)).error.kind, 'business')
    assert.equal((await roomsApi.loadRoom('Nhom_Hoc', 0)).error.kind, 'business')
    assert.equal(calls.length, 0)
})

const sessionChecking = toolkit.createAction('auth/sessionChecking')
const sessionStarted = toolkit.createAction('auth/sessionStarted')
const sessionCleared = toolkit.createAction('auth/sessionCleared')
const fetchHistoryPage = { fulfilled: { type: 'messages/fetchHistoryPage/fulfilled' } }
const rooms = compile('../src/store/slices/roomsSlice.ts', {
    '@reduxjs/toolkit': toolkit,
    '../../services/roomsApi': roomsApi,
    '../../utils/conversationKey': { createConversationKey: ({ kind, name }) => JSON.stringify([kind, name]) },
    './authSlice': { sessionChecking, sessionStarted, sessionCleared },
    './messagesSlice': { fetchHistoryPage },
})

let state = rooms.default(undefined, { type: '@@INIT' })
const key = JSON.stringify(['room', 'Nhom_Hoc'])
function dispatch(action) { state = rooms.default(state, action) }
function readMetadata(data, generation = state.sessionGeneration) {
    dispatch({ type: 'messages/fetchHistoryPage/fulfilled', meta: { arg: { sessionGeneration: generation, conversation: { kind: 'room', name: data.roomName } } }, payload: { status: 'success', data: { room: data } } })
}

await check('Metadata từ lịch sử cập nhật store và đánh dấu chủ thật', async () => {
    dispatch(sessionChecking())
    dispatch(sessionStarted('Khoi'))
    readMetadata({ roomName: 'Nhom_Hoc', owner: 'Khoi', ownerKnown: true, members: ['Khoi', 'Kiet'], membersKnown: true, membership: 'unknown' })
    assert.equal(state.byKey[key].room.membership, 'owner')
    assert.equal(state.byKey[key].room.ownerKnown, true)
})
await check('Trang sau thiếu metadata giữ chủ và thành viên trang đầu', async () => {
    readMetadata({ roomName: 'Nhom_Hoc', page: 2, ownerKnown: false, membersKnown: false, membership: 'unknown' })
    assert.equal(state.byKey[key].room.owner, 'Khoi')
    assert.deepEqual(Array.from(state.byKey[key].room.members), ['Khoi', 'Kiet'])
    assert.equal(state.byKey[key].room.membership, 'owner')
})
await check('Mảng rỗng mới được xác nhận thay thế thành viên cũ', async () => {
    readMetadata({ roomName: 'Nhom_Hoc', ownerKnown: false, membersKnown: true, members: [], membership: 'unknown' })
    assert.equal(state.byKey[key].room.membersKnown, true)
    assert.equal(state.byKey[key].room.members.length, 0)
})
await check('Tài khoản khác không được suy làm chủ từ gần đây', async () => {
    dispatch(sessionCleared())
    dispatch(sessionStarted('Kiet'))
    readMetadata({ roomName: 'Nhom_Hoc', owner: 'Khoi', ownerKnown: true, membersKnown: false, membership: 'unknown' })
    assert.equal(state.byKey[key].room.membership, 'unknown')
    readMetadata({ roomName: 'Nhom_Hoc', ownerKnown: false, membersKnown: true, members: ['Kiet'], membership: 'unknown' })
    assert.equal(state.byKey[key].room.membership, 'member')
})
await check('CREATE/JOIN success mới cập nhật quyền tường minh', async () => {
    dispatch(rooms.roomConfirmed({ name: 'DaTao', ownerKnown: false, membersKnown: false, membership: 'owner' }))
    assert.equal(state.byKey[JSON.stringify(['room', 'DaTao'])].room.membership, 'owner')
    dispatch(rooms.roomConfirmed({ name: 'DaThamGia', ownerKnown: false, membersKnown: false, membership: 'member' }))
    assert.equal(state.byKey[JSON.stringify(['room', 'DaThamGia'])].room.membership, 'member')
})
await check('Response phiên cũ không ghi đè metadata tài khoản mới', async () => {
    const oldGeneration = state.sessionGeneration
    dispatch(sessionCleared())
    dispatch(sessionStarted('Another'))
    readMetadata({ roomName: 'Nhom_Hoc', owner: 'Khoi', ownerKnown: true, membersKnown: true, members: ['Khoi'], membership: 'unknown' }, oldGeneration)
    assert.equal(state.byKey[key], undefined)
})
await check('Refresh lỗi giữ nguyên metadata đã tải', async () => {
    readMetadata({ roomName: 'Nhom_Hoc', ownerKnown: true, owner: 'Another', membersKnown: true, members: ['Another'], membership: 'unknown' })
    const arg = { name: 'Nhom_Hoc', sessionGeneration: state.sessionGeneration }
    dispatch(rooms.refreshRoomMembers.pending('reqA', arg))
    dispatch(rooms.refreshRoomMembers.fulfilled({ status: 'error', error: { kind: 'connection', message: 'offline' } }, 'reqA', arg))
    assert.equal(state.byKey[key].error.message, 'offline')
    assert.equal(state.byKey[key].room.members[0], 'Another')
    assert.equal(state.byKey[key].loading, false)
})

await check('Lỗi làm mới vẫn hiện trong lúc thử lại', async () => {
    const arg = { name: 'Nhom_Hoc', sessionGeneration: state.sessionGeneration }
    dispatch(rooms.refreshRoomMembers.pending('reqRetry', arg))
    assert.equal(state.byKey[key].loading, true)
    assert.equal(state.byKey[key].error.message, 'offline')
    assert.deepEqual(Array.from(state.byKey[key].room.members), ['Another'])
    dispatch(rooms.refreshRoomMembers.fulfilled({ status: 'error', error: { kind: 'timeout', message: 'timed out' } }, 'reqRetry', arg))
    assert.equal(state.byKey[key].error.message, 'timed out')
})
await check('Trang lịch sử 2 thiếu userList không xóa cảnh báo hoặc danh sách cũ', async () => {
    response({ name: 'Nhom_Hoc', page: 2, chatData: [message] })
    const result = await roomsApi.loadRoom('Nhom_Hoc', 2)
    assert.equal(result.status, 'success')
    assert.equal(result.data.membersKnown, false)
    readMetadata(result.data)
    assert.equal(state.byKey[key].error.message, 'timed out')
    assert.deepEqual(Array.from(state.byKey[key].room.members), ['Another'])
    assert.equal(state.byKey[key].room.membersKnown, true)
})
await check('F15 vẫn render cảnh báo, nút Thử lại và danh sách cũ', async () => {
    const React = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const panel = compile('../src/features/rooms/MemberList.tsx', {
        'react/jsx-runtime': require('react/jsx-runtime'),
    }).default
    const html = renderToStaticMarkup(React.createElement(panel, {
        room: state.byKey[key].room,
        currentUser: 'Another',
        loading: state.byKey[key].loading,
        error: state.byKey[key].error,
        onRefresh: () => {},
        onClose: () => {},
    }))
    assert.match(html, /Thử lại/)
    assert.match(html, /role="alert"/)
    assert.match(html, /Danh sách đang hiển thị có thể đã cũ/)
    assert.match(html, /Another/)
    assert.match(html, /Thành viên · 1/)
})
await check('Làm mới thành công nhưng không có userList vẫn cảnh báo và giữ dữ liệu', async () => {
    const oldLoadedAt = state.byKey[key].loadedAt
    const arg = { name: 'Nhom_Hoc', sessionGeneration: state.sessionGeneration }
    dispatch(rooms.refreshRoomMembers.pending('reqMissing', arg))
    response({ name: 'Nhom_Hoc', page: 1, chatData: [] })
    const result = await roomsApi.loadRoom('Nhom_Hoc', 1)
    assert.equal(result.status, 'success')
    dispatch(rooms.refreshRoomMembers.fulfilled(result, 'reqMissing', arg))
    assert.equal(state.byKey[key].error.kind, 'parse')
    assert.match(state.byKey[key].error.message, /danh sách thành viên mới/)
    assert.deepEqual(Array.from(state.byKey[key].room.members), ['Another'])
    assert.equal(state.byKey[key].loadedAt, oldLoadedAt)
})
await check('Chỉ danh sách thành viên mới hợp lệ xóa cảnh báo và cập nhật dữ liệu', async () => {
    const arg = { name: 'Nhom_Hoc', sessionGeneration: state.sessionGeneration }
    dispatch(rooms.refreshRoomMembers.pending('reqSuccess', arg))
    assert.equal(state.byKey[key].error.kind, 'parse')
    response({ name: 'Nhom_Hoc', page: 1, own: 'Another', userList: ['Another', 'Kiet'], chatData: [] })
    const result = await roomsApi.loadRoom('Nhom_Hoc', 1)
    dispatch(rooms.refreshRoomMembers.fulfilled(result, 'reqSuccess', arg))
    assert.equal(state.byKey[key].error, null)
    assert.equal(state.byKey[key].loading, false)
    assert.deepEqual(Array.from(state.byKey[key].room.members), ['Another', 'Kiet'])
    assert.ok(state.byKey[key].loadedAt)
})
await check('roomConfirmed thiếu danh sách không xóa lỗi tải trước', async () => {
    const arg = { name: 'Nhom_Hoc', sessionGeneration: state.sessionGeneration }
    dispatch(rooms.refreshRoomMembers.pending('reqAnother', arg))
    dispatch(rooms.refreshRoomMembers.fulfilled({ status: 'error', error: { kind: 'connection', message: 'offline again' } }, 'reqAnother', arg))
    dispatch(rooms.roomConfirmed({ name: 'Nhom_Hoc', ownerKnown: true, owner: 'Another', membersKnown: false, membership: 'owner' }))
    assert.equal(state.byKey[key].error.message, 'offline again')
    assert.deepEqual(Array.from(state.byKey[key].room.members), ['Another', 'Kiet'])
})

const chatApi = compile('../src/services/chatApi.ts', {
    '../utils/richMessage': { parseRichMessage: () => null },
    './roomsApi': roomsApi,
    './socketClient': { socketClient: {}, SocketRequestError },
})
await check('Lịch sử Kiệt dùng duy nhất roomsApi, giữ metadata cùng response', async () => {
    response({ name: 'Nhom_Hoc', owner: 'Khoi', userList: ['Khoi'], chatData: [message] })
    const result = await chatApi.loadHistory({ kind: 'room', name: 'Nhom_Hoc' }, 1, 'Khoi')
    assert.equal(result.status, 'success')
    assert.equal(result.data.messages.length, 1)
    assert.equal(result.data.room.owner, 'Khoi')
    assert.equal(calls.length, 1)
})

console.log(`CV45: ${total}/${total} kiểm tra giả lập đạt`)
