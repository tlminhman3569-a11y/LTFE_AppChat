import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const base = new URL('../src/', import.meta.url)
const asJson = value => JSON.parse(JSON.stringify(value))
let passed = 0
async function check(label, run) {
    await run()
    passed++
    console.log(`PASS CV46-${String(passed).padStart(2, '0')} ${label}`)
}
function load(path, dependencies) {
    const source = readFileSync(new URL(path, base), 'utf8')
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const module = { exports: {} }
    runInNewContext(output, { module, exports: module.exports, require: name => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
        return dependencies[name]
    }, console, setTimeout, clearTimeout })
    return module.exports
}
function nodes(root) {
    if (Array.isArray(root)) return root.flatMap(nodes)
    if (!root || typeof root !== 'object') return []
    return [root, ...nodes(root.props?.children)]
}
function text(node) {
    if (Array.isArray(node)) return node.map(text).join(' ')
    if (node === null || node === undefined || typeof node === 'boolean') return ''
    if (typeof node !== 'object') return String(node)
    return text(node.props?.children)
}
const jsx = (type, props) => ({ type, props: props ?? {} })
function find(root, tag, value = '') {
    const result = nodes(root).find(n => n.type === tag && text(n).includes(value))
    assert.ok(result, `Missing ${tag}: ${value}`)
    return result
}

let reply = async () => ({})
let calls = []
class SocketRequestError extends Error {
    constructor(kind, wasSent) {
        super(kind)
        this.kind = kind
        this.wasSent = wasSent
    }
}
const socketClient = { request: async (event, data) => { calls.push({ event, data }); return reply() } }
const { leaveRoom } = load('services/roomsApi.ts', { './socketClient': { socketClient, SocketRequestError } })

await check('Tên trống không gửi yêu cầu', async () => {
    calls = []
    assert.equal((await leaveRoom('   ')).status, 'error')
    assert.equal(calls.length, 0)
})
await check('OUT_ROOM giữ chính xác chữ hoa thường của phòng', async () => {
    calls = []
    reply = async () => ({ event: 'OUT_ROOM', status: 'success', data: { mes: 'Đã rời' } })
    const result = await leaveRoom(' Nhom_Hoc ')
    assert.equal(result.status, 'success')
    assert.deepEqual(asJson(calls), [{ event: 'OUT_ROOM', data: { name: 'Nhom_Hoc' } }])
    assert.equal(result.data.roomName, 'Nhom_Hoc')
})
await check('Success theo data.mes không bắt buộc data.name', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'success', data: { mes: 'Rời thành công' } })
    assert.equal((await leaveRoom('A')).status, 'success')
})
await check('Success theo data.name đúng cũng đủ xác nhận', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'success', data: { name: 'A' } })
    assert.equal((await leaveRoom('A')).status, 'success')
})
await check('Success sai tên không đổi trạng thái', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'success', data: { mes: 'OK', name: 'B' } })
    assert.equal((await leaveRoom('A')).status, 'unknown')
})
await check('Sai event không xác nhận rời', async () => {
    reply = async () => ({ event: 'JOIN_ROOM', status: 'success', data: { mes: 'OK' } })
    assert.equal((await leaveRoom('A')).status, 'unknown')
})
await check('Success thiếu thông tin không xác nhận', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'success', data: {} })
    assert.equal((await leaveRoom('A')).status, 'unknown')
})
await check('Success thiếu data không xác nhận', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'success' })
    assert.equal((await leaveRoom('A')).status, 'unknown')
})
await check('Không có response object không xác nhận', async () => {
    reply = async () => null
    assert.equal((await leaveRoom('A')).status, 'unknown')
})
await check('Lỗi nghiệp vụ mes cấp ngoài', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'error', mes: 'Chủ phòng không thể rời' })
    const result = await leaveRoom('A')
    assert.equal(result.status, 'error')
    assert.equal(result.error.message, 'Chủ phòng không thể rời')
})
await check('Lỗi nghiệp vụ data dạng chuỗi', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'error', data: 'Không thể rời' })
    assert.equal((await leaveRoom('A')).error.message, 'Không thể rời')
})
await check('Lỗi nghiệp vụ data.mes', async () => {
    reply = async () => ({ event: 'OUT_ROOM', status: 'error', data: { mes: 'Từ chối' } })
    assert.equal((await leaveRoom('A')).error.message, 'Từ chối')
})
await check('Timeout đã gửi giữ unknown', async () => {
    reply = async () => { throw new SocketRequestError('timeout', true) }
    const result = await leaveRoom('A')
    assert.equal(result.status, 'unknown')
    assert.equal(result.error.kind, 'timeout')
})
await check('Mất kết nối sau khi gửi giữ unknown', async () => {
    reply = async () => { throw new SocketRequestError('connection', true) }
    assert.equal((await leaveRoom('A')).status, 'unknown')
})
await check('Mất kết nối trước gửi là error có thể thử lại', async () => {
    reply = async () => { throw new SocketRequestError('connection', false) }
    assert.equal((await leaveRoom('A')).status, 'error')
})
await check('Timeout trước gửi là error, không giả đã gửi', async () => {
    reply = async () => { throw new SocketRequestError('timeout', false) }
    assert.equal((await leaveRoom('A')).status, 'error')
})
await check('Không tự gửi JOIN_ROOM hoặc gọi lần hai', async () => {
    calls = []
    reply = async () => ({ event: 'OUT_ROOM', status: 'success', data: { mes: 'OK' } })
    await leaveRoom('A')
    assert.deepEqual(calls.map(c => c.event), ['OUT_ROOM'])
})

const { createAction, createAsyncThunk } = require('@reduxjs/toolkit')
const sessionStarted = createAction('auth/sessionStarted')
const sessionCleared = createAction('auth/sessionCleared')
const sessionChecking = createAction('auth/sessionChecking')
const fetchHistoryPage = createAsyncThunk('messages/fetchHistoryPage', async () => null)
const storeActions = load('store/slices/roomsSlice.ts', {
    '@reduxjs/toolkit': require('@reduxjs/toolkit'),
    '../../services/roomsApi': { loadRoom: async () => ({ status: 'error' }) },
    '../../utils/conversationKey': { createConversationKey: ref => JSON.stringify([ref.kind, ref.name]) },
    './authSlice': { sessionStarted, sessionCleared, sessionChecking },
    './messagesSlice': { fetchHistoryPage },
})
const reducer = storeActions.default
const roomKey = JSON.stringify(['room', 'A'])
const known = { name: 'A', owner: 'Man', ownerKnown: true, members: ['Man', 'Khoi'], membersKnown: true, membership: 'member' }
const start = () => reducer(reducer(undefined, { type: 'INIT' }), sessionStarted('Khoi'))
await check('Redux chỉ cập nhật phòng trên phiên hiện tại', async () => {
    let state = start()
    state = reducer(state, storeActions.roomConfirmed(known))
    state = reducer(state, storeActions.roomLeft({ name: 'A', sessionGeneration: 0 }))
    assert.equal(state.byKey[roomKey].room.membership, 'member')
    state = reducer(state, storeActions.roomLeft({ name: 'A', sessionGeneration: 1 }))
    assert.equal(state.byKey[roomKey].room.membership, 'left')
})
await check('Rời thành công không xóa phòng/metadata khỏi Redux', async () => {
    let state = reducer(start(), storeActions.roomConfirmed(known))
    state = reducer(state, storeActions.roomLeft({ name: 'A', sessionGeneration: 1 }))
    assert.deepEqual(asJson(state.byKey[roomKey].room.members), ['Man', 'Khoi'])
    assert.equal(state.byKey[roomKey].room.owner, 'Man')
})
await check('Kết quả unknown khóa quyền chưa xác định nhưng không xóa metadata', async () => {
    let state = reducer(start(), storeActions.roomConfirmed(known))
    state = reducer(state, storeActions.roomLeaveUncertain({ name: 'A', sessionGeneration: 1 }))
    assert.equal(state.byKey[roomKey].room.membership, 'unknown')
    assert.equal(state.byKey[roomKey].room.owner, 'Man')
})
await check('Lịch sử tới muộn không tự mở khóa trạng thái OUT_ROOM unknown', async () => {
    let state = reducer(start(), storeActions.roomConfirmed(known))
    state = reducer(state, storeActions.roomLeaveUncertain({ name: 'A', sessionGeneration: 1 }))
    const data = { roomName: 'A', page: 2, messages: [], owner: 'Man', ownerKnown: true, members: ['Man', 'Khoi'], membersKnown: true, membership: 'member' }
    state = reducer(state, fetchHistoryPage.fulfilled({ status: 'success', data: { room: data } }, 'r2', { sessionGeneration: 1 }))
    assert.equal(state.byKey[roomKey].room.membership, 'unknown')
})
await check('Dữ liệu chủ phòng xác nhận không bị suy ra rời khi unknown', async () => {
    let state = reducer(start(), storeActions.roomConfirmed({ ...known, membership: 'owner' }))
    state = reducer(state, storeActions.roomLeaveUncertain({ name: 'A', sessionGeneration: 1 }))
    assert.equal(state.byKey[roomKey].room.membership, 'owner')
})
await check('Lịch sử tải muộn không cấp lại quyền sau rời thành công', async () => {
    let state = reducer(start(), storeActions.roomConfirmed(known))
    state = reducer(state, storeActions.roomLeft({ name: 'A', sessionGeneration: 1 }))
    const data = { roomName: 'A', page: 2, messages: [], owner: 'Man', ownerKnown: true, members: ['Man', 'Khoi'], membersKnown: true, membership: 'member' }
    state = reducer(state, fetchHistoryPage.fulfilled({ status: 'success', data: { room: data } }, 'r1', { sessionGeneration: 1 }))
    assert.equal(state.byKey[roomKey].room.membership, 'left')
})
await check('JOIN thành công sau đó khôi phục membership bằng roomConfirmed', async () => {
    let state = reducer(start(), storeActions.roomConfirmed(known))
    state = reducer(state, storeActions.roomLeft({ name: 'A', sessionGeneration: 1 }))
    state = reducer(state, storeActions.roomConfirmed({ ...known, membership: 'member' }))
    assert.equal(state.byKey[roomKey].room.membership, 'member')
})
await check('Session đổi không giữ membership của tài khoản trước', async () => {
    let state = reducer(start(), storeActions.roomConfirmed(known))
    state = reducer(state, sessionCleared())
    assert.equal(state.byKey[roomKey], undefined)
    state = reducer(state, storeActions.roomLeft({ name: 'A', sessionGeneration: 1 }))
    assert.equal(state.byKey[roomKey], undefined)
})

let sessionGeneration = 10
const leaveState = load('features/rooms/leaveRoomRequestState.ts', {})
const LeaveRoom = load('features/rooms/LeaveRoom.tsx', {
    react: { useSyncExternalStore: (_subscribe, get) => get() },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../store/hooks': { useAppSelector: select => select({ auth: { sessionGeneration } }) },
    '../../store': { store: { getState: () => ({ auth: { sessionGeneration } }) } },
    './leaveRoomRequestState': leaveState,
    './roomRequestState': { clearRoomRequest: () => {}, getRoomRequest: () => null },
}).default
const room = { ...known }
const makeProps = (changes = {}) => ({ room, currentUser: 'Khoi', hasDraft: false, onClose: () => {}, onLeaveConfirmed: () => {}, ...changes })
const submit = props => find(LeaveRoom(props), 'form').props.onSubmit({ preventDefault() {} })
await check('Chủ phòng bị chặn ở UI và không gọi API', async () => {
    leaveState.clearLeaveRequests()
    let called = 0
    const props = makeProps({ room: { ...room, membership: 'owner', owner: 'Khoi' }, leaveRoom: async () => { called++; return { status: 'success', data: { roomName: 'A' } } } })
    assert.equal(find(LeaveRoom(props), 'button', 'Xác nhận rời phòng').props.disabled, true)
    await submit(props)
    assert.equal(called, 0)
})
await check('Rời thành công chỉ sau xác nhận và không tự gọi khi mở dialog', async () => {
    leaveState.clearLeaveRequests()
    let called = 0
    let completed = 0
    const props = makeProps({ leaveRoom: async () => { called++; return { status: 'success', data: { roomName: 'A' } } }, onLeaveConfirmed: () => completed++ })
    LeaveRoom(props)
    assert.equal(called, 0)
    await submit(props)
    assert.equal(called, 1)
    assert.equal(completed, 1)
    assert.equal(leaveState.getLeaveRequest(10, 'A').status, 'success')
})
await check('Phản hồi tên sai ở dialog giữ unknown', async () => {
    leaveState.clearLeaveRequests()
    let completed = 0
    await submit(makeProps({ leaveRoom: async () => ({ status: 'success', data: { roomName: 'B' } }), onLeaveConfirmed: () => completed++ }))
    assert.equal(leaveState.getLeaveRequest(10, 'A').status, 'unknown')
    assert.equal(completed, 0)
})
await check('Business error cho phép bấm lại', async () => {
    leaveState.clearLeaveRequests()
    let called = 0
    const props = makeProps({ leaveRoom: async () => { called++; return { status: 'error', error: { kind: 'business', message: 'Không được phép' } } } })
    await submit(props)
    assert.equal(leaveState.getLeaveRequest(10, 'A').status, 'error')
    await submit(props)
    assert.equal(called, 2)
})
await check('Lỗi kết nối trước gửi cho phép thử lại, không chuyển unknown', async () => {
    leaveState.clearLeaveRequests()
    const props = makeProps({ leaveRoom: async () => ({ status: 'error', error: { kind: 'connection', message: 'Chưa gửi' } }) })
    await submit(props)
    assert.equal(leaveState.getLeaveRequest(10, 'A').status, 'error')
    assert.equal(find(LeaveRoom(props), 'button', 'Xác nhận rời phòng').props.disabled, false)
})
await check('Timeout unknown khóa gửi lặp cùng tên/phòng', async () => {
    leaveState.clearLeaveRequests()
    let called = 0
    const props = makeProps({ leaveRoom: async () => { called++; return { status: 'unknown', error: { kind: 'timeout', message: 'Hết thời gian' } } } })
    await submit(props)
    await submit(props)
    assert.equal(called, 1)
    assert.equal(leaveState.getLeaveRequest(10, 'A').status, 'unknown')
    assert.equal(find(LeaveRoom(props), 'button', 'Xác nhận rời phòng').props.disabled, true)
})
await check('Đóng dialog khi pending không hủy yêu cầu đã gửi', async () => {
    leaveState.clearLeaveRequests()
    let resolve
    let completed = 0
    let closed = 0
    const props = makeProps({ leaveRoom: () => new Promise(done => { resolve = done }), onClose: () => closed++, onLeaveConfirmed: () => completed++ })
    const pending = submit(props)
    assert.equal(leaveState.getLeaveRequest(10, 'A').status, 'pending')
    find(LeaveRoom(props), 'button', 'Đóng').props.onClick()
    assert.equal(closed, 1)
    resolve({ status: 'success', data: { roomName: 'A' } })
    await pending
    assert.equal(completed, 1)
})
await check('Response từ session cũ không cập nhật session mới', async () => {
    leaveState.clearLeaveRequests()
    let resolve
    let completed = 0
    const pending = submit(makeProps({ leaveRoom: () => new Promise(done => { resolve = done }), onLeaveConfirmed: () => completed++ }))
    sessionGeneration = 11
    resolve({ status: 'success', data: { roomName: 'A' } })
    await pending
    assert.equal(completed, 0)
    sessionGeneration = 10
    leaveState.clearLeaveRequests()
})

let componentStates = [false, false]
let hookIndex = 0
const dispatches = []
const panelStore = {
    rooms: { byKey: { [roomKey]: { room: known, loadedAt: '2026-11-17T00:00:00.000Z', loading: false, error: null } } },
    messages: {},
}
const Panel = load('features/rooms/RoomMembersPanel.tsx', {
    react: { useState: initial => { const i = hookIndex++; return [componentStates[i] ?? initial, next => { componentStates[i] = next }] } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../store/hooks': { useAppDispatch: () => action => dispatches.push(action), useAppSelector: sel => sel(panelStore) },
    '../../store/slices/roomsSlice': {
        refreshRoomMembers: payload => ({ type: 'rooms/refreshMembers', payload }),
        roomLeft: payload => ({ type: 'rooms/roomLeft', payload }),
        roomLeaveUncertain: payload => ({ type: 'rooms/roomLeaveUncertain', payload }),
    },
    '../../services/roomsApi': { leaveRoom },
    './LeaveRoom': { default: function MockLeaveRoom() {} },
    '../../utils/conversationKey': { createConversationKey: ref => JSON.stringify([ref.kind, ref.name]) },
    './MemberList': { default: function MockMemberList() {} },
}).default
const panelProps = { conversation: { kind: 'room', name: 'A' }, currentUser: 'Khoi', sessionGeneration: 10, canLoad: true, draft: 'Nháp chưa gửi', onLeaveConfirmed: () => {} }
const renderPanel = () => { hookIndex = 0; return Panel(panelProps) }
await check('Panel thành viên nối nút Rời phòng sang LeaveRoom', async () => {
    componentStates = [false, false]
    find(renderPanel(), 'button', 'Thành viên').props.onClick()
    const members = nodes(renderPanel()).find(node => node.type?.name === 'MockMemberList')
    assert.ok(members)
    members.props.onRequestLeave()
    const dialog = nodes(renderPanel()).find(node => node.type?.name === 'MockLeaveRoom')
    assert.ok(dialog)
    assert.equal(dialog.props.draftPreview, 'Nháp chưa gửi')
    assert.equal(dialog.props.leaveRoom, leaveRoom)
})
await check('Panel đánh dấu unknown và success bằng Redux đúng phòng', async () => {
    dispatches.length = 0
    const dialog = nodes(renderPanel()).find(node => node.type?.name === 'MockLeaveRoom')
    dialog.props.onStatusChange({ kind: 'room', name: 'A' }, 'unknown')
    dialog.props.onLeaveConfirmed({ kind: 'room', name: 'A' })
    assert.deepEqual(asJson(dispatches), [
        { type: 'rooms/roomLeaveUncertain', payload: { name: 'A', sessionGeneration: 10 } },
        { type: 'rooms/roomLeft', payload: { name: 'A', sessionGeneration: 10 } },
    ])
})

console.log(`CV46: ${passed}/${passed} giả lập đạt, không gọi API thật.`)
