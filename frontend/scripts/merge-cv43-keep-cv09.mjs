import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const layoutPath = path.join(root, 'frontend/src/components/ChatLayout.tsx')
const pagePath = path.join(root, 'frontend/src/features/chat/ChatPage.tsx')
const previewPath = path.join(root, 'docs/CV43_ChatLayout_CV09_preview.txt')
const backupPath = path.join(root, 'CV43_ChatLayout_truoc_khoi_phuc.txt')
const args = process.argv.slice(2)
const baseFileIndex = args.indexOf('--base-file')
const useSample = baseFileIndex >= 0
const apply = args.includes('--apply')

function requireMatch(text, pattern, description) {
    if (!pattern.test(text)) throw new Error(`Khong tim thay ${description}. Dung ghi de file; doi chieu source moi nhat cua nhom.`)
}

function insertImport(text, line) {
    if (text.includes(line)) return text
    if (!/\bimport\s/.test(text)) throw new Error('Khong tim thay import trong ChatLayout')
    return `${line}\n${text}`
}

function addHook(text) {
    if (text.includes('const loadSelectedHistory =')) return text
    const marker = '    function selectConversation('
    const position = text.indexOf(marker)
    if (position === -1) throw new Error('Khong tim thay selectConversation trong CV09 ChatLayout')
    const block = [
        "    const loadSelectedHistory = useCallback<ChatService['loadHistory']>((conversation, page, user) => {",
        "        if (usingMockData || conversation.kind === 'room') {",
        '            return mockChatService.loadHistory(conversation, page, user)',
        '        }',
        '        return loadChatHistory(conversation, page, user)',
        '    }, [usingMockData])',
        '',
    ].join('\n')
    return text.slice(0, position) + block + text.slice(position)
}

function changeTag(text, tagName, transform) {
    const matcher = new RegExp(`<${tagName}\\b[\\s\\S]*?\\/>`)
    const match = text.match(matcher)
    if (!match) throw new Error(`Khong tim thay <${tagName} /> trong CV09 ChatLayout`)
    return text.replace(matcher, transform(match[0]))
}

function merge(base) {
    requireMatch(base, /Thử kết nối lại/, 'nut Thu ket noi lai cua CV09 trong origin/develop')
    requireMatch(base, /\breconnectCount\b/, 'reconnectCount cua CV09 trong origin/develop')
    requireMatch(base, /useChatDrafts\(\)/, 'useChatDrafts cua CV09')
    requireMatch(base, /<ChatPage\b/, 'ChatPage')
    requireMatch(base, /<ConversationSidebar\b/, 'ConversationSidebar')

    let text = base
    if (!/\buseCallback\b/.test(text)) {
        const react = /import\s*\{([^}]+)\}\s*from\s*['"]react['"]/
        const match = text.match(react)
        if (!match) throw new Error('Khong tim thay named import react')
        const named = match[1].split(',').map(item => item.trim()).filter(Boolean)
        named.unshift('useCallback')
        text = text.replace(react, `import { ${named.join(', ')} } from 'react'`)
    }

    text = insertImport(text, "import { loadHistory as loadChatHistory } from '../services/chatApi'")
    text = insertImport(text, "import type { ChatService } from '../types/message'")
    if (!text.includes('const [usingMockData, setUsingMockData]')) {
        const selection = /const \[selectedConversation, setSelectedConversation\]\s*=\s*useState<ConversationRef \| null>\(null\)/
        const match = text.match(selection)
        if (!match) throw new Error('Khong tim thay state selectedConversation')
        text = text.replace(selection, `${match[0]}\n    const [usingMockData, setUsingMockData] = useState(false)`)
    }

    text = addHook(text)
    text = changeTag(text, 'ConversationSidebar', tag => tag.includes('onMockModeChange=')
        ? tag : tag.replace(/\/>$/, ' onMockModeChange={setUsingMockData} />'))
    text = changeTag(text, 'ChatPage', tag => {
        let updated = tag
        if (/loadHistory=\{mockChatService\.loadHistory\}/.test(updated)) {
            updated = updated.replace('loadHistory={mockChatService.loadHistory}', 'loadHistory={loadSelectedHistory}')
        } else if (!updated.includes('loadHistory={loadSelectedHistory}')) {
            throw new Error('ChatPage dung adapter lich su khac; khong tu y ghi de')
        }
        if (!updated.includes('reconnectCount={reconnectCount}')) {
            updated = updated.replace(/\/>$/, ' reconnectCount={reconnectCount} />')
        }
        return updated
    })

    requireMatch(text, /return loadChatHistory\(conversation, page, user\)/, 'CV24 people loadHistory')
    requireMatch(text, /onMockModeChange=\{setUsingMockData\}/, 'mock mode CV43')
    requireMatch(text, /reconnectCount=\{reconnectCount\}/, 'prop reconnectCount CV09')
    requireMatch(text, /Thử kết nối lại/, 'nut ket noi thu cong CV09')
    requireMatch(text, /useChatDrafts\(\)/, 'nhap duoc giu')
    return text
}

try {
    const base = useSample
        ? readFileSync(args[baseFileIndex + 1], 'utf8')
        : execFileSync('git', ['show', 'origin/develop:frontend/src/components/ChatLayout.tsx'], { cwd: root, encoding: 'utf8' })
    const merged = merge(base)
    mkdirSync(path.dirname(previewPath), { recursive: true })
    writeFileSync(previewPath, merged, 'utf8')
    console.log(`DA TAO BAN XEM TRUOC: ${previewPath}`)

    if (apply) {
        if (useSample) throw new Error('Khong duoc --apply voi --base-file')
        if (existsSync(backupPath)) throw new Error(`Da co file sao luu ${backupPath}; doi ten truoc khi chay lai`)
        if (!existsSync(layoutPath) || !existsSync(pagePath)) throw new Error('Thieu ChatLayout hoac ChatPage')
        const page = readFileSync(pagePath, 'utf8')
        requireMatch(page, /\breconnectCount\b/, 'reconnectCount trong ChatPage moi cua CV09')
        writeFileSync(backupPath, readFileSync(layoutPath, 'utf8'), 'utf8')
        writeFileSync(layoutPath, merged, 'utf8')
        console.log(`DA AP DUNG: ${layoutPath}`)
        console.log(`BAN SAO LUU: ${backupPath}`)
        console.log('Kiem tra git diff va chay test truoc khi commit.')
    } else {
        console.log('Chua ghi de ChatLayout. Mo preview trong WebStorm de so sanh, hoac chay lai voi --apply sau khi kiem tra.')
    }
} catch (error) {
    console.error(`CHUA AP DUNG: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
}
