import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const base = new URL('../src/', import.meta.url)
const toolkit = require('@reduxjs/toolkit')
const sessionChecking = toolkit.createAction('auth/sessionChecking')
const sessionCleared = toolkit.createAction('auth/sessionCleared')
const sessionStarted = toolkit.createAction('auth/sessionStarted')
const fetchHistoryPage = toolkit.createAsyncThunk('messages/fetchHistoryPage', async () => {})
let passed = 0

function load(path, dependencies) {
    const source = readFileSync(new URL(path, base), 'utf8')
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const module = { exports: {} }
    runInNewContext(output, {
        module, exports: module.exports, console,
        require: name => {
            assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
            return dependencies[name]
        },
    })
    return module.exports
}

function check(label, run) {
    return Promise.resolve().then(run).then(() => {
        passed++
        console.log(`PASS CV47-${String(passed).padStart(2, '0')} ${label}`)
    })
}
const authActions = { sessionChecking, sessionCleared, sessionStarted }
const { createConversationKey } = load('utils/conversationKey.ts', {})
const conversationStore = load('utils/conversationsStoreState.ts', {})
const conversations = load('store/slices/conversationsSlice.ts', {
    '@reduxjs/toolkit': toolkit,
    '../../services/usersApi': { getRecentConversations: async () => ({ status: 'success', data: [] }) },
    '../../utils/conversationKey': { createConversationKey },
    '../../utils/conversationsStoreState': conversationStore,
    './authSlice': authActions,
})
const rooms = load('store/slices/roomsSlice.ts', {
    '@reduxjs/toolkit': toolkit,
    '../../services/roomsApi': { loadRoom: async () => ({ status: 'error' }) },
    '../../utils/conversationKey': { createConversationKey },
    './authSlice': authActions,
    './messagesSlice': { fetchHistoryPage },
})
const room = (name, membership) => ({ name, ownerKnown: false, membersKnown: false, membership })
const key = name => createConversationKey({ kind: 'room', name })
const entries = (...items) => Object.fromEntries(items.map(item => [key(item.name), { room: item }]))
const asJson = value => JSON.parse(JSON.stringify(value))

await check('Phòng đã rời không trở lại danh sách hội thoại dù GET_USER_LIST còn lưu', () => {
    const recent = [{ kind: 'room', name: 'Lop_A' }, { kind: 'people', name: 'Lop_A' }]
    assert.deepEqual(asJson(conversations.conversationsForSidebar(recent, entries(room('Lop_A', 'left')))), [{ kind: 'people', name: 'Lop_A' }])
})

await check('JOIN thành công hiện đúng một hội thoại và giữ khóa phòng/người khác nhau', () => {
    const recent = [{ kind: 'room', name: 'Lop_A', actionTime: 'trước' }, { kind: 'people', name: 'Lop_A' }]
    assert.deepEqual(asJson(conversations.conversationsForSidebar(recent, entries(room('Lop_A', 'member')))), recent)
    assert.deepEqual(asJson(conversations.conversationsForSidebar([], entries(room('Lop_A', 'member')))), [{ kind: 'room', name: 'Lop_A' }])
    assert.deepEqual(asJson(conversations.conversationsForSidebar([], entries(room('Lop_A', 'owner')))), [{ kind: 'room', name: 'Lop_A' }])
})

await check('Danh sách API trùng không tạo hai mục; tên khác chữ hoa không bị đổi', () => {
    const recent = [{ kind: 'room', name: 'Lop_A' }, { kind: 'room', name: 'Lop_A' }, { kind: 'room', name: 'lop_a' }]
    assert.deepEqual(asJson(conversations.conversationsForSidebar(recent, entries(room('Lop_A', 'member')))), [recent[0], recent[2]])
})

await check('Rời phòng xóa quyền đã xác nhận; chỉ JOIN success mới khôi phục quyền', () => {
    let state = rooms.default(undefined, { type: 'init' })
    state = rooms.default(state, sessionStarted('Nguoi_1'))
    const gen = state.sessionGeneration
    state = rooms.default(state, rooms.roomConfirmed(room('Lop_A', 'member')))
    assert.equal(state.byKey[key('Lop_A')].room.membership, 'member')
    state = rooms.default(state, rooms.roomLeft({ name: 'Lop_A', sessionGeneration: gen }))
    assert.equal(state.byKey[key('Lop_A')].room.membership, 'left')
    assert.equal(conversations.conversationsForSidebar([{ kind: 'room', name: 'Lop_A' }], state.byKey).length, 0)
    state = rooms.default(state, rooms.roomConfirmed(room('Lop_A', 'member')))
    assert.equal(state.byKey[key('Lop_A')].room.membership, 'member')
    assert.equal(conversations.conversationsForSidebar([], state.byKey).length, 1)
})

await check('Lịch sử đọc lại không tự khôi phục quyền sau khi đã rời', () => {
    let state = rooms.default(undefined, { type: 'init' })
    state = rooms.default(state, sessionStarted('Nguoi_1'))
    state = rooms.default(state, rooms.roomLeft({ name: 'Lop_A', sessionGeneration: state.sessionGeneration }))
    const metadata = { roomName: 'Lop_A', page: 1, messages: [], ownerKnown: false, membersKnown: true, members: ['Nguoi_1'], membership: 'unknown' }
    state = rooms.default(state, {
        type: fetchHistoryPage.fulfilled.type,
        payload: { status: 'success', data: { room: metadata } },
        meta: { arg: { sessionGeneration: state.sessionGeneration } },
    })
    assert.equal(state.byKey[key('Lop_A')].room.membership, 'left')
})

const jsx = (type, props) => ({ type, props: props ?? {} })
const nodes = root => Array.isArray(root) ? root.flatMap(nodes)
    : !root || typeof root !== 'object' ? [] : [root, ...nodes(root.props?.children)]
const requestState = load('features/rooms/roomRequestState.ts', {})
const leaveState = load('features/rooms/leaveRoomRequestState.ts', {})
const mockReact = {
    useEffect: callback => { callback() },
    useRef: initial => ({ current: initial }),
    useState: initial => [initial, () => {}],
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
}
const JoinRoom = load('features/rooms/JoinRoom.tsx', {
    react: mockReact,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    './roomMockServices': { mockJoinRoom: async () => ({ status: 'error' }) },
    './roomRequestState': requestState,
    '../../store/hooks': { useAppSelector: selector => selector({ auth: { sessionGeneration: 3 } }) },
    '../../store': { store: { getState: () => ({ auth: { sessionGeneration: 3 } }) } },
    './leaveRoomRequestState': leaveState,
})

await check('Chỉ mở hoặc Hủy hộp Tham gia lại không gửi JOIN_ROOM', () => {
    requestState.clearRoomRequests()
    let calls = 0
    const dialog = JoinRoom.default({ initialName: 'Lop_A', onClose: () => {}, joinRoom: async () => { calls++; return { status: 'success', data: room('Lop_A', 'member') } } })
    const close = nodes(dialog).find(node => node.type === 'button' && node.props.type === 'button' && node.props.children === 'Hủy')
    assert.ok(close)
    close.props.onClick()
    assert.equal(calls, 0)
})

await check('Đóng hộp lúc JOIN đang chờ: success vẫn ghi nhận membership, không tự mở phòng', async () => {
    requestState.clearRoomRequests()
    let resolveSend
    let calls = 0
    const confirmed = []
    const selected = []
    const dialog = JoinRoom.default({
        initialName: 'Lop_A',
        onClose: () => {},
        onJoined: (result, shouldSelect) => confirmed.push({ result, shouldSelect }),
        onSelectConversation: value => selected.push(value),
        joinRoom: () => { calls++; return new Promise(resolve => { resolveSend = resolve }) },
    })
    const form = nodes(dialog).find(node => node.type === 'form')
    const close = nodes(dialog).find(node => node.type === 'button' && node.props.children === 'Hủy')
    const submission = form.props.onSubmit({ preventDefault() {} })
    close.props.onClick()
    resolveSend({ status: 'success', data: room('Lop_A', 'member') })
    await submission
    assert.equal(calls, 1)
    assert.equal(confirmed.length, 1)
    assert.equal(confirmed[0].shouldSelect, false)
    assert.equal(confirmed[0].result.membership, 'member')
    assert.equal(selected.length, 0)
})

await check('JOIN error/unknown không gọi xác nhận thành viên', async () => {
    for (const status of ['error', 'unknown']) {
        requestState.clearRoomRequests()
        let joined = 0
        const dialog = JoinRoom.default({
            initialName: 'Lop_A', onClose: () => {}, onJoined: () => { joined++ },
            joinRoom: async () => ({ status, error: { kind: 'business', message: 'Từ chối' } }),
        })
        const form = nodes(dialog).find(node => node.type === 'form')
        await form.props.onSubmit({ preventDefault() {} })
        assert.equal(joined, 0)
    }
})

console.log(`CV47: ${passed}/${passed} ca đạt`)
