import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = path => readFileSync(new URL(path, new URL('../src/', import.meta.url)), 'utf8')
let passed = 0

function check(name, verify) {
    verify()
    passed += 1
    console.log(`PASS ${name}`)
}

const layout = read('components/ChatLayout.tsx')
const chatPage = read('features/chat/ChatPage.tsx')

check('ChatLayout khong goi lai reLogin rieng', () => {
    assert.doesNotMatch(layout, /\breLogin\s*\(/)
    assert.doesNotMatch(layout, /\breadStoredSession\b/)
    assert.doesNotMatch(layout, /\bsetReconnectCount\b/)
})

check('ChatLayout su dung hook CV09', () => {
    assert.match(layout, /import\s*\{\s*useSocket\s*\}\s*from\s*['"]\.\.\/hooks\/useSocket['"]/) 
    assert.match(layout, /\{\s*connectionStatus\s*,\s*reconnectCount\s*,\s*canUseSocket\s*\}\s*=\s*useSocket\(\)/)
    assert.match(layout, /import\s*\{\s*retrySocketConnection\s*\}\s*from\s*['\"]\.\.\/features\/auth\/reconnectSession['\"]/)
})

check('Nut thu ket noi lai chay qua CV09', () => {
    assert.match(layout, /onClick=\{retrySocketConnection\}/)
    assert.match(layout, /connectionStatus === ['\"]disconnected['\"]/)
    assert.match(layout, /Thử kết nối lại/)
})

check('Khong co bo dem reconnectCount cuc bo', () => {
    assert.doesNotMatch(layout, /useState\(0\)[\s\S]{0,80}setReconnectCount/)
    assert.doesNotMatch(layout, /\bsetReconnectCount\s*\(/)
})

check('CV09 truyen reconnectCount vao ChatPage', () => {
    assert.match(layout, /<ChatPage[\s\S]*?reconnectCount=\{reconnectCount\}/)
})

check('Tao lai ChatHistory theo reconnectCount tu CV09', () => {
    const tag = chatPage.match(/<ChatHistory\b[\s\S]*?\/>/)?.[0]
    assert.ok(tag)
    let expression = tag.match(/key=\{([^}]+)\}/)?.[1]
    assert.ok(expression)
    if (/^[a-zA-Z_$][\w$]*$/.test(expression.trim())) {
        const variable = expression.trim()
        expression = chatPage.match(new RegExp(`(?:const|let)\\s+${variable}\\s*=\\s*([^;\\n]+)`))?.[1]
        assert.ok(expression)
    }
    for (const name of ['sessionGeneration', 'conversationKey', 'reconnectCount']) {
        assert.match(expression, new RegExp(`\\b${name}\\b`))
    }
})

check('Composer va ban nhap khong phu thuoc reconnectCount', () => {
    const composer = chatPage.match(/<Composer\s[\s\S]*?\/>/)?.[0]
    assert.ok(composer)
    assert.match(composer, /key=\{conversationKey\}/)
    assert.doesNotMatch(composer, /reconnectCount|sessionGeneration/)
    assert.match(layout, /useChatDrafts\(\)/)
})

check('Hoi thoai duoc giu trong ChatLayout', () => {
    assert.match(layout, /\[selectedConversation, setSelectedConversation\] = useState/)
    assert.doesNotMatch(layout, /setSelectedConversation\(null\)[\s\S]*?retrySocketConnection/)
})

check('CV24 duoc giu cho chat rieng ngoai fixture', () => {
    assert.match(layout, /return loadChatHistory\(conversation, page, user\)/)
    assert.match(layout, /if \(usingMockData \|\| conversation\.kind === 'room'\)/)
    assert.match(layout, /loadHistory=\{loadSelectedHistory\}/)
})

check('currentUser tu Redux duoc truyen vao API lich su', () => {
    assert.match(layout, /useAppSelector\(state => state\.auth\)/)
    assert.match(layout, /currentUser=\{currentUser\}/)
    assert.match(chatPage, /await loadHistory\(\{ kind, name \}, 1, currentUser\)/)
})

check('ChatLayout khong tao ket noi thu hai', () => {
    assert.doesNotMatch(layout, /new WebSocket|socketClient\.request\(['"]RE_LOGIN/)
})

const hookPath = new URL('../src/hooks/useSocket.ts', import.meta.url)
if (existsSync(hookPath)) {
    const hook = read('hooks/useSocket.ts')
    check('CV09 hook co reconnectCount', () => {
        assert.match(hook, /\breconnectCount\b/)
    })
    check('CV09 hook chi cap reconnectCount, retry duoc export tai reconnectSession', () => {
        assert.match(hook, /\breconnectCount\b/)
        assert.doesNotMatch(hook, /\bretrySocketConnection\b/)
        const recovery = read('features/auth/reconnectSession.ts')
        assert.match(recovery, /export function retrySocketConnection\(\)/)
        assert.match(recovery, /store\.dispatch\(sessionReconnected\(\)\)/)
    })
} else {
    console.log('SKIP: Chua co hooks/useSocket.ts cua CV09 trong bo file cung cap.')
}

console.log(`${passed} checks source-level PASS`)
console.log(`Node.js ${process.version}`)
console.log('Chua phai ket qua hai tinh huong WebSocket API that.')
