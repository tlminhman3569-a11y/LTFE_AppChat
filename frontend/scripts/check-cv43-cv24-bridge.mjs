import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = new URL('../src/', import.meta.url)
const read = path => readFileSync(new URL(path, src), 'utf8')
let passed = 0

function check(title, run) {
    run()
    passed += 1
    console.log(`PASS ${title}`)
}

const layout = read('components/ChatLayout.tsx')
const page = read('features/chat/ChatPage.tsx')
const api = read('services/chatApi.ts')
const store = read('store/slices/authSlice.ts')
const checkUser = read('features/users/CheckUser.tsx')
const sidebar = read('components/ConversationSidebar.tsx')

check('currentUser va sessionGeneration thuoc auth session', () => {
    assert.match(store, /currentUser: string \| null/)
    assert.match(store, /sessionGeneration: number/)
    assert.match(store, /state\.currentUser = action\.payload/)
})

check('ChatLayout lay currentUser tu Redux session', () => {
    assert.match(layout, /useAppSelector\(state => state\.auth\)/)
    assert.match(layout, /\{ currentUser, authStatus, connectionStatus, sessionGeneration \}/)
})

check('ChatLayout truyen currentUser cho ChatPage', () => {
    assert.match(layout, /<ChatPage[\s\S]*?currentUser=\{currentUser\}/)
    assert.match(layout, /sessionGeneration=\{sessionGeneration\}/)
})

check('ChatPage truyen currentUser cho ChatHistory', () => {
    assert.match(page, /<ChatHistory[\s\S]*?currentUser=\{currentUser\}/)
})

check('ChatHistory goi loadHistory cung currentUser cho trang 1', () => {
    assert.match(page, /await loadHistory\(\{ kind, name \}, 1, currentUser\)/)
})

check('ChatHistory goi loadHistory cung currentUser khi tai tin cu', () => {
    assert.match(page, /await loadHistory\(\{ kind, name \}, page \+ 1, currentUser\)/)
})

check('ChatHistory reset khi doi sessionGeneration', () => {
    assert.match(page, /key=\{JSON\.stringify\(\[sessionGeneration, conversationKey\]\)\}/)
})

check('ChatLayout su dung chatApi trong che do API that cho people', () => {
    assert.match(layout, /import \{ loadHistory as loadChatHistory \} from '\.\.\/services\/chatApi'/)
    assert.match(layout, /return loadChatHistory\(conversation, page, user\)/)
    assert.match(layout, /loadHistory=\{loadSelectedHistory\}/)
})

check('Mock chi dung khi chon fixture hoac lich su phong CV45', () => {
    assert.match(layout, /if \(usingMockData \|\| conversation\.kind === 'room'\)/)
    assert.match(layout, /return mockChatService\.loadHistory\(conversation, page, user\)/)
    assert.match(layout, /onMockModeChange=\{setUsingMockData\}/)
})

check('CV24 gui GET_PEOPLE_CHAT_MES dung ten va so trang', () => {
    assert.match(api, /socketClient\.request\('GET_PEOPLE_CHAT_MES', \{ name: conversation\.name, page \}\)/)
})

check('CV24 can session user va loc dung nguoi gui/nhan', () => {
    assert.match(api, /!currentUser\?\.trim\(\)/)
    assert.match(api, /message\.name === conversation\.name && message\.to === currentUser/)
    assert.match(api, /message\.name === currentUser && message\.to === conversation\.name/)
})

check('Chat khong phu thuoc username co trong fixture', () => {
    assert.doesNotMatch(api, /mockChatService|fixtures\/users|fixtures\/chat/)
})

check('Username duoc tra cuu chi khi nguoi dung xac nhan', () => {
    assert.match(checkUser, /<form onSubmit=\{handleCheck\}/)
    assert.match(checkUser, /await checkExists\(user\)/)
    assert.match(checkUser, /onSelectConversation\(\{ kind: 'people', name: user \}\)/)
})

check('Che do API that cho phep kiem tra username ngoai goi y', () => {
    assert.match(sidebar, /!isMock && \(filter === 'people' \|\| conversations\.length === 0\)/)
    assert.match(sidebar, /<CheckUser/)
})

check('Khong tao WebSocket thu hai trong diem noi', () => {
    assert.doesNotMatch(layout, /new WebSocket|fetch\(/)
    assert.doesNotMatch(api, /new WebSocket|fetch\(/)
})

console.log(`${passed}/15 checks CV43-CV24 bridge passed`)
console.log(`Node.js ${process.version}`)
console.log('Chi kiem tra ma nguon; khong phai bang chung WebSocket API that.')
