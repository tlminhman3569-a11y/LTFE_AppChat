import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const src = new URL('../src/', import.meta.url)
let passed = 0
async function check(description, task) {
    await task()
    console.log(`PASS CV46-REJOIN-${++passed}: ${description}`)
}
function load(path, modules = {}) {
    const input = readFileSync(new URL(path, src), 'utf8')
    const code = ts.transpileModule(input, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText
    const module = { exports: {} }
    runInNewContext(code, {
        module, exports: module.exports, console, setTimeout, clearTimeout,
        require: name => {
            if (name.endsWith('.css')) return {}
            assert.ok(Object.hasOwn(modules, name), `Missing ${name} in ${path}`)
            return modules[name]
        },
    })
    return module.exports
}
const req = load('features/rooms/roomRequestState.ts')
const leave = load('features/rooms/leaveRoomRequestState.ts')
const toolkit = require('@reduxjs/toolkit')
const sessionStarted = toolkit.createAction('auth/sessionStarted')
const sessionCleared = toolkit.createAction('auth/sessionCleared')
const sessionChecking = toolkit.createAction('auth/sessionChecking')
const fetchHistoryPage = toolkit.createAsyncThunk('messages/fetchHistoryPage', async () => null)
const slice = load('store/slices/roomsSlice.ts', {
    '@reduxjs/toolkit': toolkit,
    '../../services/roomsApi': { loadRoom: async () => ({ status: 'error' }) },
    '../../utils/conversationKey': { createConversationKey: item => JSON.stringify([item.kind, item.name]) },
    './authSlice': { sessionStarted, sessionCleared, sessionChecking },
    './messagesSlice': { fetchHistoryPage },
})
const roomName = 'Lop_A'
const roomKey = JSON.stringify(['room', roomName])
const data = { name: roomName, ownerKnown: true, owner: 'Man', membersKnown: true, members: ['Man', 'Khoi'], membership: 'member' }
let redux = slice.default(slice.default(undefined, { type: 'init' }), sessionStarted('Khoi'))
const generation = redux.sessionGeneration
let joinCalls = 0
let outCalls = 0
let opened = false
let draft = 'Bản nháp chưa gửi'
const events = []
const jsx = (type, props) => ({ type, props: props ?? {} })
const nodes = root => Array.isArray(root) ? root.flatMap(nodes)
    : !root || typeof root !== 'object' ? [] : [root, ...nodes(root.props?.children)]
const textOf = node => Array.isArray(node) ? node.map(textOf).join('')
    : !node || typeof node !== 'object' ? String(node ?? '') : textOf(node.props?.children)
const find = (tree, type, text) => {
    const node = nodes(tree).find(item => item.type === type && (!text || textOf(item).includes(text)))
    assert.ok(node, `Cannot find ${type} with label ${text}`)
    return node
}
const mockReact = {
    useEffect: callback => { callback() },
    useRef: value => ({ current: value }),
    useState: value => [value, () => {}],
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
}
const mockHooks = { useAppSelector: selector => selector({ auth: { sessionGeneration: generation } }) }
const mockStore = { store: { getState: () => ({ auth: { sessionGeneration: generation } }) } }
const joinComponent = load('features/rooms/JoinRoom.tsx', {
    react: mockReact, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    './roomMockServices': { mockJoinRoom: () => { throw Error('Must use provided stub') } },
    './roomRequestState': req,
    '../../store/hooks': mockHooks, '../../store': mockStore,
    './leaveRoomRequestState': leave,
}).default
const leaveComponent = load('features/rooms/LeaveRoom.tsx', {
    react: mockReact, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../store/hooks': mockHooks, '../../store': mockStore,
    './leaveRoomRequestState': leave,
    './roomRequestState': req,
}).default
const joinProps = () => ({
    initialName: roomName,
    onClose: () => {},
    onJoined: joined => { redux = slice.default(redux, slice.roomConfirmed(joined)); events.push('JOIN confirmed') },
    joinRoom: async name => {
        joinCalls++
        events.push(`JOIN_ROOM ${name}`)
        return { status: 'success', data }
    },
})
const leaveProps = (result, statusChanges) => ({
    room: data, currentUser: 'Khoi', hasDraft: true, draftPreview: draft,
    onClose: () => {}, onLeaveConfirmed: () => { throw Error('Business error must not leave') },
    leaveRoom: async name => { outCalls++; events.push(`OUT_ROOM ${name}`); return result },
    onStatusChange: (_room, status, error) => {
        statusChanges.push({ status, kind: error?.kind })
        if (status === 'error' && error?.kind === 'business') {
            redux = slice.default(redux, slice.roomLeaveRejected({ name: roomName, sessionGeneration: generation, message: error.message }))
        }
    },
})
const joinButton = () => find(joinComponent(joinProps()), 'button', 'Tham gia phòng')
const sendAllowed = () => {
    const entry = redux.byKey[roomKey]
    const l = leave.getLeaveRequest(generation, roomName)
    return (entry.room.membership === 'member' || entry.room.membership === 'owner') && !entry.leaveRejected
        && l?.status !== 'pending' && l?.status !== 'unknown' && l?.status !== 'success'
}
const submitJoin = props => find(joinComponent(props), 'form').props.onSubmit({ preventDefault() {} })
const submitLeave = props => find(leaveComponent(props), 'form').props.onSubmit({ preventDefault() {} })

await check('Trước JOIN, chỉ mở dialog không gọi service', () => {
    req.clearRoomRequests(); leave.clearLeaveRequests()
    joinComponent(joinProps())
    assert.equal(joinCalls, 0)
})
await check('JOIN đầu thành công, đúng một lời gọi', async () => {
    await submitJoin(joinProps())
    assert.equal(joinCalls, 1)
    assert.equal(req.getRoomRequest('join', roomName, generation)?.status, 'success')
    assert.equal(redux.byKey[roomKey].room.membership, 'member')
})
await check('Chưa OUT: JOIN success cũ vẫn chống gửi lặp', async () => {
    assert.equal(joinButton().props.disabled, true)
    assert.equal(await req.sendRoomRequest('join', roomName, generation, () => generation,
        () => { joinCalls++; throw Error('must not send') }), null)
    assert.equal(joinCalls, 1)
})
await check('OUT_ROOM error nghiệp vụ giữ nháp, giữ membership, đánh dấu xung đột', async () => {
    const statuses = []
    await submitLeave(leaveProps({ status: 'error', error: { kind: 'business', message: 'Server refused OUT_ROOM' } }, statuses))
    assert.equal(outCalls, 1)
    assert.equal(draft, 'Bản nháp chưa gửi')
    assert.equal(redux.byKey[roomKey].room.membership, 'member')
    assert.equal(redux.byKey[roomKey].leaveRejected, 'Server refused OUT_ROOM')
    assert.equal(leave.getLeaveRequest(generation, roomName)?.status, 'error')
    assert.equal(statuses.at(-1).kind, 'business')
})
await check('OUT error chỉ giải khóa cache JOIN success, không tự JOIN', () => {
    assert.equal(req.getRoomRequest('join', roomName, generation), null)
    assert.equal(joinCalls, 1)
    assert.equal(joinButton().props.disabled, false)
    assert.equal(sendAllowed(), false)
})
await check('Mở/đóng JOIN sau OUT error vẫn không tự gọi JOIN', () => {
    opened = true
    const props = joinProps()
    const tree = joinComponent(props)
    find(tree, 'button', 'Hủy').props.onClick()
    assert.equal(joinCalls, 1)
})
await check('Bấm tham gia sau OUT error tạo JOIN_ROOM thứ hai, không dùng kết quả cũ', async () => {
    await submitJoin(joinProps())
    assert.equal(joinCalls, 2)
    assert.deepEqual(events.filter(x => x.startsWith('JOIN_ROOM')), [`JOIN_ROOM ${roomName}`, `JOIN_ROOM ${roomName}`])
    assert.equal(req.getRoomRequest('join', roomName, generation)?.status, 'success')
})
await check('JOIN mới success xóa cảnh báo và OUT error cũ, mở quyền gửi', () => {
    assert.equal(redux.byKey[roomKey].leaveRejected, undefined)
    assert.equal(redux.byKey[roomKey].room.membership, 'member')
    assert.equal(leave.getLeaveRequest(generation, roomName), null)
    assert.equal(sendAllowed(), true)
    assert.equal(draft, 'Bản nháp chưa gửi')
})
await check('JOIN đang pending không thể gửi trùng (đúng tên, đúng phiên)', async () => {
    const name = 'Pending_room'
    let finish
    let calls = 0
    const first = req.sendRoomRequest('join', name, generation, () => generation,
        () => { calls++; return new Promise(done => { finish = done }) })
    const second = await req.sendRoomRequest('join', name, generation, () => generation,
        () => { calls++; throw Error('should not send twice') })
    assert.equal(calls, 1)
    assert.equal(second, null)
    assert.equal(req.allowJoinRetryAfterRejectedLeave(name, generation), false)
    assert.equal(req.getRoomRequest('join', name, generation)?.status, 'pending')
    finish({ status: 'success', data: { ...data, name } })
    await first
})
await check('JOIN unknown vẫn khóa, không dùng OUT error để tự retry lệnh mơ hồ', async () => {
    const name = 'Unknown_room'
    await req.sendRoomRequest('join', name, generation, () => generation,
        async () => ({ status: 'unknown', error: { kind: 'timeout', message: 'Not sure' } }))
    assert.equal(req.allowJoinRetryAfterRejectedLeave(name, generation), false)
    assert.equal(req.getRoomRequest('join', name, generation)?.status, 'unknown')
})
await check('Không động tới kết quả JOIN phòng khác hoặc phiên khác', async () => {
    const other = 'Other_room'
    await req.sendRoomRequest('join', other, generation, () => generation,
        async () => ({ status: 'success', data: { ...data, name: other } }))
    await req.sendRoomRequest('join', roomName, generation + 1, () => generation + 1,
        async () => ({ status: 'success', data }))
    assert.equal(req.allowJoinRetryAfterRejectedLeave(roomName, generation), true)
    assert.equal(req.getRoomRequest('join', other, generation)?.status, 'success')
    assert.equal(req.getRoomRequest('join', roomName, generation + 1)?.status, 'success')
})
await check('Lỗi OUT trước gửi không giải khóa JOIN success', async () => {
    await req.sendRoomRequest('join', roomName, generation, () => generation,
        async () => ({ status: 'success', data }))
    const states = []
    await submitLeave(leaveProps({ status: 'error', error: { kind: 'connection', message: 'not sent' } }, states))
    assert.equal(req.getRoomRequest('join', roomName, generation)?.status, 'success')
    assert.equal(joinButton().props.disabled, true)
})
await check('Chặn điều kiện gửi trong ChatLayout và thông báo JOIN success lỗi thời trên Sidebar', () => {
    const layout = readFileSync(new URL('components/ChatLayout.tsx', src), 'utf8')
    const sidebar = readFileSync(new URL('components/ConversationSidebar.tsx', src), 'utf8')
    assert.match(layout, /&& !roomPermission\?\.leaveRejected/)
    assert.match(sidebar, /!confirmedEntry\?\.leaveRejected/)
})
await check('Cần xác nhận rõ ràng; không có JOIN_ROOM tự động trong luồng xử lý OUT error', () => {
    const component = readFileSync(new URL('features/rooms/LeaveRoom.tsx', src), 'utf8')
    assert.match(component, /allowJoinRetryAfterRejectedLeave\(room\.name, sessionGeneration\)/)
    assert.ok(!/joinRoom\(/.test(component))
    assert.equal(events.filter(x => x.startsWith('JOIN_ROOM')).length, 2)
})
assert.equal(opened, true)
console.log(`CV46 JOIN retry after OUT rejection: ${passed}/${passed} local tests PASS.`)
