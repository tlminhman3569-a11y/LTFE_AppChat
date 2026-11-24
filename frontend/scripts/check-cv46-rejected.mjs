import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const src = new URL('../src/', import.meta.url)
const asPlain = value => JSON.parse(JSON.stringify(value))
let passed = 0
async function check(name, run) {
    await run()
    passed++
    console.log(`PASS CV46-REJECTED-${passed}: ${name}`)
}
function load(path, modules) {
    const source = readFileSync(new URL(path, src), 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: {
            target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
        } }).outputText
    const module = { exports: {} }
    runInNewContext(output, {
        module, exports: module.exports, console, setTimeout, clearTimeout,
        require: name => {
            if (name.endsWith('.css')) return {}
            assert.ok(Object.hasOwn(modules, name), `Unknown dependency ${name} in ${path}`)
            return modules[name]
        },
    })
    return module.exports
}
const toolkit = require('@reduxjs/toolkit')
const sessionStarted = toolkit.createAction('auth/sessionStarted')
const sessionCleared = toolkit.createAction('auth/sessionCleared')
const sessionChecking = toolkit.createAction('auth/sessionChecking')
const fetchHistoryPage = toolkit.createAsyncThunk('messages/fetchHistoryPage', async () => null)
const actions = load('store/slices/roomsSlice.ts', {
    '@reduxjs/toolkit': toolkit,
    '../../services/roomsApi': { loadRoom: async () => ({ status: 'error' }) },
    '../../utils/conversationKey': { createConversationKey: ref => JSON.stringify([ref.kind, ref.name]) },
    './authSlice': { sessionStarted, sessionCleared, sessionChecking },
    './messagesSlice': { fetchHistoryPage },
})
const reduce = actions.default
const key = JSON.stringify(['room', 'A'])
const me = 'Khoi'
const confirmed = { name: 'A', owner: 'Man', ownerKnown: true, members: ['Man', me], membersKnown: true, membership: 'member' }
const metadata = { roomName: 'A', page: 1, messages: [], owner: 'Man', ownerKnown: true, members: ['Man', me], membersKnown: true, membership: 'unknown' }
const start = () => reduce(reduce(undefined, { type: 'init' }), sessionStarted(me))
const initMember = () => reduce(start(), actions.roomConfirmed(confirmed))
const rejected = s => reduce(s, actions.roomLeaveRejected({ name: 'A', sessionGeneration: 1, message: 'Server rejected OUT_ROOM' }))
const loadMetadata = s => reduce(s, fetchHistoryPage.fulfilled({ status: 'success', data: { room: metadata } }, 'req-id', { sessionGeneration: 1 }))

await check('OUT_ROOM error giữ nguyên membership cũ nhưng đánh dấu xung đột', () => {
    const state = rejected(initMember())
    assert.equal(state.byKey[key].room.membership, 'member')
    assert.equal(state.byKey[key].leaveRejected, 'Server rejected OUT_ROOM')
    assert.deepEqual(asPlain(state.byKey[key].room.members), ['Man', 'Khoi'])
})
await check('GET_ROOM_CHAT_MES tải muộn, dù vẫn thấy user trong userList, không xóa xung đột', () => {
    const state = loadMetadata(rejected(initMember()))
    assert.equal(state.byKey[key].leaveRejected, 'Server rejected OUT_ROOM')
    assert.equal(state.byKey[key].room.membership, 'member')
})
await check('OUT_ROOM bị từ chối không biến phòng thành left', () => {
    const state = rejected(initMember())
    assert.notEqual(state.byKey[key].room.membership, 'left')
})
await check('JOIN_ROOM success hoặc OUT_ROOM success mới gỡ cờ xung đột', () => {
    const joined = reduce(rejected(initMember()), actions.roomConfirmed(confirmed))
    assert.equal(joined.byKey[key].leaveRejected, undefined)
    assert.equal(joined.byKey[key].room.membership, 'member')
    const left = reduce(rejected(initMember()), actions.roomLeft({ name: 'A', sessionGeneration: 1 }))
    assert.equal(left.byKey[key].leaveRejected, undefined)
    assert.equal(left.byKey[key].room.membership, 'left')
})
await check('Response của phiên cũ không ghi trạng thái lỗi vào tài khoản mới', () => {
    const afterLogout = reduce(initMember(), sessionCleared())
    const stale = reduce(afterLogout, actions.roomLeaveRejected({ name: 'A', sessionGeneration: 1, message: 'stale' }))
    assert.equal(stale.byKey[key], undefined)
})
await check('RE_LOGIN chỉ hạ quyền member cũ xuống unknown, giữ metadata để so sánh', () => {
    const state = reduce(initMember(), { type: 'auth/sessionReconnected' })
    assert.equal(state.byKey[key].room.membership, 'unknown')
    assert.equal(state.byKey[key].loadedAt, null)
    assert.deepEqual(asPlain(state.byKey[key].room.members), ['Man', 'Khoi'])
})
await check('GET_ROOM_CHAT_MES mới có username sau RE_LOGIN mới được ghi nhận member', () => {
    const stale = reduce(initMember(), { type: 'auth/sessionReconnected' })
    const fresh = loadMetadata(stale)
    assert.equal(fresh.byKey[key].room.membership, 'member')
})
await check('RE_LOGIN không tạo lại quyền đã rời hoặc chủ phòng', () => {
    const left = reduce(reduce(initMember(), actions.roomLeft({ name: 'A', sessionGeneration: 1 })), { type: 'auth/sessionReconnected' })
    assert.equal(left.byKey[key].room.membership, 'left')
    const owner = reduce(reduce(start(), actions.roomConfirmed({ ...confirmed, membership: 'owner', owner: me })), { type: 'auth/sessionReconnected' })
    assert.equal(owner.byKey[key].room.membership, 'owner')
})

const jsx = (type, props) => ({ type, props: props ?? {} })
function allNodes(root) {
    if (Array.isArray(root)) return root.flatMap(allNodes)
    if (!root || typeof root !== 'object') return []
    return [root, ...allNodes(root.props?.children)]
}
const dispatches = []
let states = [true, true]
let stateIndex = 0
const panelState = { auth: { sessionGeneration: 1 }, rooms: { byKey: { [key]: { room: confirmed, loading: false, loadedAt: null, error: null } } }, messages: {} }
const panelActions = {
    refreshRoomMembers: payload => ({ type: 'refresh', payload }),
    roomLeft: payload => ({ type: 'left', payload }),
    roomLeaveRejected: payload => ({ type: 'reject', payload }),
    roomLeaveUncertain: payload => ({ type: 'uncertain', payload }),
}
const Panel = load('features/rooms/RoomMembersPanel.tsx', {
    react: { useState: init => [states[stateIndex] ?? init, v => { states[stateIndex] = v; stateIndex++ }] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../store/hooks': { useAppDispatch: () => action => { dispatches.push(action); return action }, useAppSelector: selector => selector(panelState) },
    '../../store/slices/roomsSlice': panelActions,
    '../../services/roomsApi': { leaveRoom: async () => ({ status: 'error', error: { kind: 'business', message: 'No membership' } }) },
    './LeaveRoom': { default: function LeaveRoomMock() {} },
    '../../utils/conversationKey': { createConversationKey: ref => JSON.stringify([ref.kind, ref.name]) },
    './MemberList': { default: function MemberListMock() {} },
})
const renderPanel = () => { stateIndex = 0; return Panel.default({
    conversation: { kind: 'room', name: 'A' }, currentUser: me,
    sessionGeneration: 1, canLoad: true, draft: 'nháp', onLeaveConfirmed() {},
}) }
const getLeaveDialog = () => {
    const dialog = allNodes(renderPanel()).find(n => n.type?.name === 'LeaveRoomMock')
    assert.ok(dialog)
    return dialog.props
}
await check('Business error gắn cờ conflict và chỉ truy vấn đọc phòng, không JOIN', () => {
    dispatches.length = 0
    getLeaveDialog().onStatusChange({ kind: 'room', name: 'A' }, 'error', { kind: 'business', message: 'No membership' })
    assert.deepEqual(dispatches.map(a => a.type), ['reject', 'refresh'])
    assert.deepEqual(asPlain(dispatches[0].payload), { name: 'A', sessionGeneration: 1, message: 'No membership' })
})
await check('Lỗi trước gửi không tạo xung đột và không GET_ROOM_CHAT_MES', () => {
    dispatches.length = 0
    getLeaveDialog().onStatusChange({ kind: 'room', name: 'A' }, 'error', { kind: 'connection', message: 'Not sent' })
    assert.equal(dispatches.length, 0)
})
await check('OUT_ROOM unknown giữ logic cũ, khóa quyền theo đường Redux', () => {
    dispatches.length = 0
    getLeaveDialog().onStatusChange({ kind: 'room', name: 'A' }, 'unknown')
    assert.equal(dispatches.length, 1)
    assert.equal(dispatches[0].type, 'uncertain')
})
await check('MemberList hiển thị xung đột, không còn khẳng định Bạn · Thành viên', () => {
    const MemberList = load('features/rooms/MemberList.tsx', { 'react/jsx-runtime': { jsx, jsxs: jsx } }).default
    const tree = MemberList({ room: confirmed, currentUser: me, leaveRejection: 'OUT rejected',
        loading: false, error: null, onRefresh() {}, onClose() {}, onRequestLeave() {} })
    function readText(node) {
        if (Array.isArray(node)) return node.map(readText).join(' ')
        if (node === null || node === undefined || typeof node === 'boolean') return ''
        if (typeof node !== 'object') return String(node)
        return readText(node.props?.children)
    }
    const rendered = readText(tree)
    assert.match(rendered, /Cần xác minh/)
    assert.ok(!rendered.includes('Bạn · Thành viên'))
})
await check('ChatLayout buộc chặn gửi khi OUT_ROOM đã bị từ chối', () => {
    const code = readFileSync(new URL('components/ChatLayout.tsx', src), 'utf8')
    assert.match(code, /&& !roomPermission\?\.leaveRejected/)
})
const leaveRequests = load('features/rooms/leaveRoomRequestState.ts', {})
await check('JOIN success xóa lỗi OUT_ROOM đã kết thúc, cho rời lần sau', () => {
    for (const status of ['error', 'unknown', 'success']) {
        leaveRequests.updateLeaveRequest(1, 'A', { status, message: 'cũ' })
        assert.equal(leaveRequests.resetLeaveAfterJoin(1, 'A'), true)
        assert.equal(leaveRequests.getLeaveRequest(1, 'A'), null)
    }
})
await check('JOIN không tự hủy yêu cầu OUT_ROOM còn pending', () => {
    leaveRequests.updateLeaveRequest(1, 'A', { status: 'pending', message: 'chờ' })
    assert.equal(leaveRequests.resetLeaveAfterJoin(1, 'A'), false)
    assert.equal(leaveRequests.getLeaveRequest(1, 'A').status, 'pending')
    leaveRequests.clearLeaveRequests()
})
console.log(`CV46 rejected/reconcile: ${passed}/${passed} ca đạt (offline).`)
