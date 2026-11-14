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
    assert.match(layout, /\{ currentUser, authStatus, sessionGeneration \}/)
    assert.match(layout, /\{ connectionStatus, reconnectCount, canUseSocket \} = useSocket\(\)/)
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

check('Khoa lich su theo session, hoi thoai va luot reconnect neu co CV09', () => {
    const tag = page.match(/<ChatHistory\b[\s\S]*?\/>/)?.[0]
    assert.ok(tag, 'Thieu ChatHistory')
    const start = tag.indexOf('key={')
    assert.ok(start !== -1, 'Thieu key cua ChatHistory')
    const expression = tag.slice(start + 5)
    let depth = 1
    let end = 0
    for (; end < expression.length; end++) {
        if (expression[end] === '{') depth++
        if (expression[end] === '}') depth--
        if (depth === 0) break
    }
    assert.equal(depth, 0, 'Key JSX khong dong dung')
    let key = expression.slice(0, end)
    if (/^[a-zA-Z_$][\w$]*$/.test(key.trim())) {
        const name = key.trim()
        const assignment = page.match(new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*([^;\\n]+)`))
        assert.ok(assignment, `Khong tim thay gia tri ${name}`)
        key = assignment[1]
    }
    assert.match(key, /\bsessionGeneration\b/)
    assert.match(key, /\bconversationKey\b/)
    if (/\breconnectCount\b/.test(page) || /\breconnectCount\b/.test(layout)) {
        assert.match(key, /\breconnectCount\b/)
        assert.match(layout, /reconnectCount=\{reconnectCount\}/)
        assert.match(layout, /Thử kết nối lại/)
    }
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

check('Ban nhap va lich su co khoa doc lap khi tai lai', () => {
    assert.match(layout, /useChatDrafts\(\)/)
    assert.match(page, /<Composer[\s\S]*?key=\{conversationKey\}/)
    assert.match(page, /<ChatHistory[\s\S]*?key=\{/)
})

if (/\breconnectCount\b/.test(page) || /\breconnectCount\b/.test(layout)) {
    check('CV09 duoc truyen vao ChatPage va giu luong tai lai', () => {
        assert.match(layout, /reconnectCount=\{reconnectCount\}/)
        assert.match(layout, /Thử kết nối lại/)
        assert.match(page, /\breconnectCount\b/)
    })
} else {
    console.log('SKIP: Source dang kiem tra chua co CV09 moi cua origin/develop')
}

check('CV09 retry do hook so huu, khong co reLogin tu ChatLayout', () => {
    assert.match(layout, /import \{ useSocket \} from '\.\.\/hooks\/useSocket'/)
    assert.match(layout, /import \{ retrySocketConnection \} from ['\"]\.\.\/features\/auth\/reconnectSession['\"]/)
    assert.match(layout, /\{ connectionStatus, reconnectCount, canUseSocket \} = useSocket\(\)/)
    assert.match(layout, /onClick=\{retrySocketConnection\}/)
    assert.doesNotMatch(layout, /\breLogin\s*\(/)
    assert.doesNotMatch(layout, /\bsetReconnectCount\b/)
})

console.log(`${passed} checks CV43-CV24 bridge passed`)
console.log(`Node.js ${process.version}`)
console.log('Chi kiem tra ma nguon; khong phai bang chung WebSocket API that.')
