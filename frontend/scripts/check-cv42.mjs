import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
    normalizeRecentConversations,
    parseGetUserListResponse,
} from '../src/utils/normalizeRecentConversations.ts'
import {
    emptyConversationsState,
    finishConversationsLoad,
    startConversationsLoad,
} from '../src/utils/conversationsStoreState.ts'
import { filterRecentConversations } from '../src/utils/filterRecentConversations.ts'
import { createConversationKey } from '../src/utils/conversationKey.ts'

let passed = 0

function check(label, action) {
    action()
    passed += 1
    console.log(`PASS ${label}`)
}

function readSource(path) {
    return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
}

function success(value) {
    return { status: 'success', data: value }
}

function error(message) {
    return { status: 'error', error: { kind: 'connection', message } }
}

const rawList = [
    { name: 'minh_an', type: 0, actionTime: '2026-11-13 08:00:00' },
    { name: 'minh_an', type: 1, actionTime: '2026-11-13 07:59:00' },
    { name: 'nhom_hoc', type: 1 },
]
const serverResponse = { event: 'GET_USER_LIST', status: 'success', data: rawList }
const normalized = parseGetUserListResponse(serverResponse)
assert.equal(normalized.status, 'success')
if (normalized.status !== 'success') throw Error('Failed fixture setup')
const list = normalized.data

check('Type 0 dung la people', () => assert.equal(list[0].kind, 'people'))
check('Type 1 dung la room', () => assert.equal(list[1].kind, 'room'))
check('Hai muc trung ten khac loai duoc giu', () => assert.equal(list.length, 3))
check('Khong doi name gui tu server', () => assert.equal(list[0].name, 'minh_an'))
check('Khong tu doi mui gio actionTime', () => assert.equal(list[0].actionTime, '2026-11-13 08:00:00'))
check('ActionTime thieu thi khong tu tao', () => assert.equal('actionTime' in list[2], false))
check('Mang tra ve khong sua input', () => assert.equal(JSON.stringify(rawList[0]), '{"name":"minh_an","type":0,"actionTime":"2026-11-13 08:00:00"}'))
check('Loc nguoi dung chi type 0', () => assert.equal(filterRecentConversations(list, 'minh', 'people').length, 1))
check('Loc phong chi type 1', () => assert.equal(filterRecentConversations(list, 'minh', 'room').length, 1))
check('Tat ca khong bi filter lam mat phong', () => assert.equal(filterRecentConversations(list, '').length, 3))
check('Hai khoa kind + name khac nhau', () => assert.notEqual(createConversationKey(list[0]), createConversationKey(list[1])))
check('Danhsach rong la success hop le', () => assert.deepEqual(normalizeRecentConversations([]), success([])))
check('Trung cung kind+name khong hien lap', () => {
    const actual = normalizeRecentConversations([rawList[0], rawList[0], rawList[1]])
    assert.equal(actual.status, 'success')
    if (actual.status === 'success') assert.equal(actual.data.length, 2)
})
check('Giu thu tu server', () => assert.deepEqual(list.map(item => item.kind), ['people', 'room', 'room']))
check('Thieu mang la loi parse', () => assert.equal(normalizeRecentConversations(null).status, 'error'))
check('Object thay mang la loi parse', () => assert.equal(normalizeRecentConversations({}).status, 'error'))
check('Item null la loi parse', () => assert.equal(normalizeRecentConversations([null]).status, 'error'))
check('Item chuoi la loi parse', () => assert.equal(normalizeRecentConversations(['x']).status, 'error'))
check('Type 2 la loi parse', () => assert.equal(normalizeRecentConversations([{ name: 'a', type: 2 }]).status, 'error'))
check('Type chuoi 0 khong tu ep', () => assert.equal(normalizeRecentConversations([{ name: 'a', type: '0' }]).status, 'error'))
check('Ten phong rong la loi parse', () => assert.equal(normalizeRecentConversations([{ name: ' ', type: 1 }]).status, 'error'))
check('ActionTime so khong duoc bien thanh string', () => assert.equal(normalizeRecentConversations([{ name: 'a', type: 1, actionTime: 123 }]).status, 'error'))
check('Response sai event la loi parse', () => assert.equal(parseGetUserListResponse({ ...serverResponse, event: 'LOGIN' }).status, 'error'))
check('Response thieu status la loi parse', () => assert.equal(parseGetUserListResponse({ event: 'GET_USER_LIST', data: [] }).status, 'error'))
check('Response error khong thanh success rong', () => {
    const result = parseGetUserListResponse({ event: 'GET_USER_LIST', status: 'error', data: [] })
    assert.equal(result.status, 'error')
    assert.equal('data' in result, false)
})
check('Response success thieu data la loi parse', () => assert.equal(parseGetUserListResponse({ event: 'GET_USER_LIST', status: 'success' }).status, 'error'))

const begin = startConversationsLoad(emptyConversationsState(), 4, 'request-1')
const loaded = finishConversationsLoad(begin, 4, 'request-1', success(list))

check('Bat dau tai co loading', () => assert.equal(begin.loading, true))
check('Tai lan dau nhan danh sach', () => assert.equal(loaded.items.length, 3))
check('Tai thanh cong xoa error va loading', () => {
    assert.equal(loaded.error, null)
    assert.equal(loaded.loading, false)
    assert.equal(loaded.loaded, true)
})
check('Lam moi giu danh sach cu trong luc loading', () => {
    const pending = startConversationsLoad(loaded, 4, 'request-2')
    assert.strictEqual(pending.items, loaded.items)
})

const failed = finishConversationsLoad(startConversationsLoad(loaded, 4, 'request-2'), 4, 'request-2', error('Mất kết nối'))
check('Lam moi loi giu danh sach cu', () => assert.strictEqual(failed.items, loaded.items))
check('Lam moi loi hien canh bao', () => assert.equal(failed.error, 'Mất kết nối'))
check('Lam moi loi khong gia tao empty', () => assert.equal(failed.items.length, 3))
check('Loi lan dau khong tao danh sach gia', () => {
    const state = finishConversationsLoad(startConversationsLoad(emptyConversationsState(), 4, 'r1'), 4, 'r1', error('Lỗi'))
    assert.equal(state.items.length, 0)
    assert.equal(state.loaded, false)
})
check('Thu lai thanh cong xoa canh bao', () => {
    const retried = finishConversationsLoad(startConversationsLoad(failed, 4, 'request-3'), 4, 'request-3', success(list))
    assert.equal(retried.error, null)
    assert.equal(retried.items.length, 3)
})
check('Loi unknown van giu danh sach cu', () => {
    const pending = startConversationsLoad(loaded, 4, 'unk')
    const state = finishConversationsLoad(pending, 4, 'unk', { status: 'unknown', error: { kind: 'timeout', message: 'Timeout' } })
    assert.strictEqual(state.items, loaded.items)
    assert.equal(state.error, 'Timeout')
})
check('Success rong moi thay danh sach cu', () => {
    const state = finishConversationsLoad(startConversationsLoad(loaded, 4, 'empty'), 4, 'empty', success([]))
    assert.equal(state.items.length, 0)
    assert.equal(state.loaded, true)
})
check('Phan hoi cu sai requestId bi bo qua', () => {
    const newer = startConversationsLoad(loaded, 4, 'newer')
    assert.strictEqual(finishConversationsLoad(newer, 4, 'older', success([])), newer)
})
check('Phan hoi cu sai sessionGeneration bi bo qua', () => {
    const newer = startConversationsLoad(loaded, 5, 'request-5')
    assert.strictEqual(finishConversationsLoad(newer, 4, 'request-5', success([])), newer)
})
check('Xoa phien thi xoa hoi thoai va error', () => {
    const clear = emptyConversationsState()
    assert.equal(clear.items.length, 0)
    assert.equal(clear.error, null)
    assert.equal(clear.loaded, false)
})
check('A gui, logout, B login, phan hoi A khong ghi vao B', () => {
    const a = startConversationsLoad(emptyConversationsState(), 5, 'A')
    const b = startConversationsLoad(emptyConversationsState(), 7, 'B')
    assert.strictEqual(finishConversationsLoad(b, 5, 'A', success(list)), b)
    const final = finishConversationsLoad(b, 7, 'B', success([{ kind: 'room', name: 'B-room' }]))
    assert.deepEqual(final.items.map(item => item.name), ['B-room'])
    assert.notEqual(a.requestId, final.requestId)
})

const apiCode = readSource('../src/services/usersApi.ts')
const sliceCode = readSource('../src/store/slices/conversationsSlice.ts')
const storeCode = readSource('../src/store/index.ts')
const sidebarCode = readSource('../src/components/ConversationSidebar.tsx')

check('Dung duy nhat socketClient.request GET_USER_LIST', () => assert.match(apiCode, /socketClient\.request\('GET_USER_LIST', \{\}\)/))
check('Khong tao socket hay REST endpoint thu hai', () => {
    assert.doesNotMatch(apiCode, /new WebSocket\(|socketClient\.connect\(|\bfetch\(/)
})
check('Duy tri slice Redux trong store', () => assert.match(storeCode, /conversations: conversationsReducer/))
check('Reset khi logout login restore', () => {
    for (const action of ['sessionCleared', 'sessionStarted', 'sessionChecking']) {
        assert.match(sliceCode, new RegExp(`addCase\\(${action},`))
    }
})
check('Slice kiem tra sessionGeneration', () => assert.match(sliceCode, /auth\.sessionGeneration !== sessionGeneration/))
check('Sidebar dung Redux list cho API', () => assert.match(sidebarCode, /useAppSelector\(state => state\.conversations\)/))
check('Sidebar tu tai khi da xac thuc va connected', () => assert.match(sidebarCode, /dispatch\(refreshConversations\(sessionGeneration\)\)/))
check('Mock rieng trong dev khong gia lam API', () => {
    assert.match(sidebarCode, /Nguồn: \{isMock \? 'Dữ liệu mẫu CV38' : 'GET_USER_LIST từ máy chủ'\}/)
    assert.match(sidebarCode, /import\.meta\.env\.DEV/)
})
check('Sidebar co canh bao stale va Thu lai', () => {
    assert.match(sidebarCode, /Dữ liệu đang hiển thị có thể đã cũ/)
    assert.match(sidebarCode, /onClick=\{retry\}>Thử lại/)
})
check('Sidebar loc goi y nhung tat ca van du hai loai', () => {
    assert.match(sidebarCode, /filterRecentConversations\(conversations, query\)/)
    assert.match(sidebarCode, /<ConversationList conversations=\{conversations\}/)
})
check('Khong thay doi onSelectConversation va ChatPage', () => {
    const chatLayout = readSource('../src/components/ChatLayout.tsx')
    assert.match(chatLayout, /<ConversationSidebar selectedConversation=\{selectedConversation\} onSelectConversation=\{selectConversation\}/)
})

console.log(`${passed}/${passed} checks passed`)
console.log(`Node.js ${process.version}`)
