import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createConversationKey } from '../src/utils/conversationKey.ts'
import { filterRecentConversations } from '../src/utils/filterRecentConversations.ts'
import {
    recentConversations,
    conversationsEmpty,
    conversationsError,
    conversationsUnknown,
} from '../src/fixtures/conversations.ts'
import { rooms } from '../src/fixtures/rooms.ts'
import { users } from '../src/fixtures/users.ts'

const readSource = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
let passed = 0

function check(name, fn) {
    fn()
    passed += 1
    console.log(`PASS ${name}`)
}

check('Fixture CV38 co nguoi va phong', () => {
    assert(recentConversations.some(item => item.kind === 'people'))
    assert(recentConversations.some(item => item.kind === 'room'))
})

check('Nguoi va phong cung ten minh_an', () => {
    assert(users.some(item => item.username === 'minh_an'))
    assert(rooms.some(item => item.name === 'minh_an'))
})

check('Danh sach tat ca khong mat du lieu CV38', () => {
    assert.equal(recentConversations.length, 6)
    assert.equal(filterRecentConversations(recentConversations, '').length, 6)
})

check('Tim mot phan ten trung ca hai loai', () => {
    assert.deepEqual(filterRecentConversations(recentConversations, 'minh_an').map(item => item.kind), ['people', 'room'])
})

check('Loc goi y nguoi dung', () => {
    assert.deepEqual(filterRecentConversations(recentConversations, 'minh', 'people').map(item => item.kind), ['people'])
})

check('Loc goi y phong', () => {
    assert.deepEqual(filterRecentConversations(recentConversations, 'minh', 'room').map(item => item.kind), ['room'])
})

check('Tim khong phan biet hoa thuong', () => {
    assert.equal(filterRecentConversations(recentConversations, 'KIET', 'people')[0]?.name, 'kiet_demo')
})

check('Tim giua ten phong', () => {
    assert.equal(filterRecentConversations(recentConversations, 'HOC', 'room')[0]?.name, 'nhom_hoc')
})

check('Khoang trang tuong duong o tim rong', () => {
    assert.equal(filterRecentConversations(recentConversations, '   ').length, recentConversations.length)
})

check('Khong co goi y chi la mang rong', () => {
    assert.deepEqual(filterRecentConversations(recentConversations, 'ten_khong_co'), [])
})

check('Khong sua du lieu fixture goc', () => {
    const filtered = filterRecentConversations(recentConversations, '')
    assert.deepEqual(filtered, recentConversations)
    assert.notEqual(filtered, recentConversations)
})

check('Kind va name tao hai khoa rieng', () => {
    assert.notEqual(createConversationKey({ kind: 'people', name: 'minh_an' }), createConversationKey({ kind: 'room', name: 'minh_an' }))
})

check('Fixture danh sach rong', () => {
    assert.deepEqual(conversationsEmpty, { status: 'success', data: [] })
})

check('Fixture loi tai', () => {
    assert.equal(conversationsError.status, 'error')
})

check('Fixture chua xac dinh', () => {
    assert.equal(conversationsUnknown.status, 'unknown')
})

const layout = readSource('../src/components/ChatLayout.tsx')
const sidebar = readSource('../src/components/ConversationSidebar.tsx')
const list = readSource('../src/components/ConversationList.tsx')
const userSearch = readSource('../src/features/users/UserSearch.tsx')
const roomSearch = readSource('../src/features/rooms/RoomSearch.tsx')
const routes = readSource('../src/routes/index.tsx')

check('Trang chat duoc cau hinh tai /chat', () => {
    assert.match(routes, /path="\/chat"/)
})

check('ChatLayout gan sidebar CV39 thay cho placeholder', () => {
    assert.match(layout, /import ConversationSidebar from '\.\/ConversationSidebar'/)
    assert.doesNotMatch(layout, /<SidebarPlaceholder/)
})

check('ChatLayout giu callback va hoi thoai dang chon', () => {
    assert.match(layout, /selectedConversation=\{selectedConversation\}/)
    assert.match(layout, /onSelectConversation=\{setSelectedConversation\}/)
})

check('Goi y dung fixture CV38 va ca hai component CV39', () => {
    assert.match(sidebar, /getRecentConversations/)
    assert.match(sidebar, /<UserSearch /)
    assert.match(sidebar, /<RoomSearch /)
})

check('Loc chi anh huong goi y, khong anh huong tat ca hoi thoai', () => {
    assert.match(sidebar, /filterRecentConversations\(conversations, query\)/)
    assert.match(sidebar, /<ConversationList conversations=\{conversations\}/)
})

check('Sidebar co tai, rong, loi va thu lai', () => {
    assert.match(sidebar, /role="status"/)
    assert.match(sidebar, /role="alert"/)
    assert.match(sidebar, /conversations\.length === 0/)
    assert.match(sidebar, /onClick=\{retry\}>Thử lại/)
})

check('Co bon che do fixture de thu UI', () => {
    for (const mode of ['success', 'empty', 'error', 'unknown']) {
        assert(sidebar.includes(`value="${mode}"`))
    }
})

check('Danh sach phan biet trung ten va tra kind name', () => {
    assert.match(list, /key=\{createConversationKey\(conversation\)\}|const key = createConversationKey\(conversation\)/)
    assert.match(list, /onSelectConversation\(\{ kind: conversation.kind, name: conversation.name \}\)/)
})

check('Hai component chi lay dung loai', () => {
    assert.match(userSearch, /filterRecentConversations\(conversations, query, 'people'\)/)
    assert.match(roomSearch, /filterRecentConversations\(conversations, query, 'room'\)/)
})

console.log(`${passed}/${passed} checks passed`)
