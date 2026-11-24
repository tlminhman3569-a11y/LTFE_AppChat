import { useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Provider } from 'react-redux'
import ChatPage from '../src/features/chat/ChatPage'
import { store } from '../src/store'
import { sessionStarted } from '../src/store/slices/authSlice'
import { fetchHistoryPage, messageReceived, reconcileOutgoing } from '../src/store/slices/messagesSlice'
import { createConversationKey } from '../src/utils/conversationKey'
import type { Message, TextRun } from '../src/types/message'
import { serializeRichMessage } from '../src/utils/richMessage'
import '../src/styles/global.css'

const conversation = { kind: 'people', name: 'peer' } as const
const generation = () => store.getState().auth.sessionGeneration
const checks: string[] = []
function check(condition: boolean, label: string) {
    if (!condition) throw new Error(label)
    checks.push(label)
}
const pause = () => new Promise(resolve => setTimeout(resolve, 100))
function message(id: number): Message {
    return { id, kind: 'people', name: 'peer', to: 'demo', mes: 'Tin ' + id + ' — nội dung có dấu 😊\nDòng thứ hai.' }
}
function addPage(ids: number[], page: number) {
    const arg = { conversation, page, sessionGeneration: generation() }
    const request = 'page-' + page
    store.dispatch(fetchHistoryPage.pending(request, arg))
    store.dispatch(fetchHistoryPage.fulfilled({ status: 'success',
        data: { conversation, page, messages: ids.map(message) } }, request, arg))
}
store.dispatch(sessionStarted('demo'))
addPage(Array.from({ length: 40 }, (_, index) => 40 - index), 1)

let selectChat: (selected: boolean) => void
let showErrors: (visible: boolean) => void
export function Probe() {
    const [selected, setSelected] = useState(false)
    const [draft, setDraft] = useState<TextRun[]>([{ text: 'Nháp được giữ 😊', bold: true, italic: true, size: 18 }])
    const [errors, setErrors] = useState(false)
    useLayoutEffect(() => {
        selectChat = setSelected
        showErrors = setErrors
    }, [])
    return <Provider store={store}><main className="chat-layout">
        <header className="session-bar"><h1>App Chat</h1><span>demo</span><button>Đăng xuất</button></header>
        <div className={'chat-columns' + (selected ? ' has-conversation' : '')}>
            <aside className="chat-sidebar">Danh sách</aside>
            <ChatPage conversation={selected ? conversation : null} conversationKey={selected ? createConversationKey(conversation) : null}
                currentUser="demo" authStatus="authenticated" connectionStatus="disconnected" sessionGeneration={generation()}
                canSend={false} draft={draft}
                pending={errors ? [{ ...message(99), localId: 'pending', sentAt: 0, status: 'unconfirmed' }] : []}
                sendError={errors ? 'Không gửi được. Nháp vẫn được giữ.' : ''}
                reconcileError={errors ? 'Mất kết nối, vui lòng thử lại.' : ''} onCheckHistory={() => {}}
                onBack={() => setSelected(false)}
                onDraftChange={(_, runs) => setDraft(runs)} onSend={() => { throw new Error('Không được gửi khi offline') }} />
        </div>
    </main></Provider>
}

async function run() {
    createRoot(document.getElementById('root')!).render(<Probe />)
    await pause()
    flushSync(() => selectChat(true))
    await pause()
    const history = document.querySelector<HTMLDivElement>('.chat-history')!
    const bubbles = () => Array.from(history.querySelectorAll<HTMLElement>('.chat-message'))
    const bottomGap = () => history.scrollHeight - history.clientHeight - history.scrollTop
    check(bottomGap() < 2, 'mở lịch sử ở cuối')
    flushSync(() => store.dispatch(messageReceived({ conversation, message: message(41), viewed: true })))
    await pause()
    check(bottomGap() < 2, 'đang ở cuối: theo tin mới')

    history.scrollTop = 250
    history.dispatchEvent(new Event('scroll'))
    const anchor = bubbles().find(bubble => bubble.getBoundingClientRect().bottom > history.getBoundingClientRect().top)!
    const anchorText = anchor.textContent
    const anchorTop = anchor.getBoundingClientRect().top
    const scrollTop = history.scrollTop
    flushSync(() => store.dispatch(messageReceived({ conversation, message: message(42), viewed: true })))
    await pause()
    check(Math.abs(history.scrollTop - scrollTop) < 2, 'đọc cũ: append không kéo cuộn')
    check(Boolean(document.querySelector('.chat-new-messages')), 'đọc cũ: có nút Có tin mới')
    flushSync(() => addPage([0, -1, -2, -3, -4], 2))
    await pause()
    const retained = bubbles().find(bubble => bubble.textContent === anchorText)!
    check(Math.abs(retained.getBoundingClientRect().top - anchorTop) < 2, 'prepend giữ nguyên tin đang đọc')
    document.querySelector<HTMLButtonElement>('.chat-new-messages')!.click()
    await pause()
    check(bottomGap() < 2 && !document.querySelector('.chat-new-messages'), 'chọn Có tin mới mới xuống cuối')

    const encoded = serializeRichMessage({ version: 1, clientMessageId: 'scroll-record',
        runs: [{ text: 'Tin chưa có ID máy chủ', bold: false, italic: false, size: 16 }] })
    if (encoded.status !== 'success') throw new Error(encoded.error.message)
    const noId: Message = { kind: 'people', name: 'demo', to: 'peer', mes: encoded.data }
    flushSync(() => store.dispatch(messageReceived({ conversation, message: noId, viewed: true })))
    await pause()
    const arg = { conversation, sessionGeneration: generation() }
    flushSync(() => {
        store.dispatch(reconcileOutgoing.pending('reconcile', arg))
        store.dispatch(reconcileOutgoing.fulfilled({ status: 'success', data: {
            conversation, page: 1, messages: [{ ...noId, id: 500 }],
        } }, 'reconcile', arg))
        store.dispatch(messageReceived({ conversation, message: message(43), viewed: true }))
    })
    await pause()
    check(bottomGap() < 2, 'đối chiếu bổ sung ID vẫn nhận ra tin cuối trước khi append')

    for (const [width, height] of [[320, 568], [394, 844], [844, 390]]) {
        const frame = window.frameElement as HTMLIFrameElement
        frame.style.width = width + 'px'
        frame.style.height = height + 'px'
        flushSync(() => selectChat(false))
        await pause()
        flushSync(() => selectChat(true))
        await pause()
        const page = document.querySelector<HTMLElement>('.chat-page')!
        const composer = document.querySelector<HTMLElement>('.chat-composer')!
        check(document.documentElement.scrollWidth <= width, 'không tràn ngang ' + width + 'x' + height)
        check(page.getBoundingClientRect().bottom <= height + 1, 'khung chat trong viewport ' + width + 'x' + height)
        check(composer.getBoundingClientRect().bottom <= height + 1, 'composer trong viewport ' + width + 'x' + height)
        check(document.querySelector<HTMLDivElement>('.chat-history')!.clientHeight > 0, 'lịch sử có vùng cuộn ' + width + 'x' + height)
        check(document.querySelector('[role="textbox"]')?.textContent === 'Nháp được giữ 😊', 'quay lại giữ nháp ' + width)
        check(document.querySelector<HTMLButtonElement>('.chat-composer button[type="submit"]')!.disabled, 'offline khóa gửi ' + width)
    }

    // Giả lập VisualViewport nhỏ đi, không phải bằng chứng bàn phím thiết bị thật.
    const frame = window.frameElement as HTMLIFrameElement
    frame.style.width = '394px'
    frame.style.height = '844px'
    await pause()
    const viewport = window.visualViewport!
    Object.defineProperty(viewport, 'height', { configurable: true, value: 450 })
    viewport.dispatchEvent(new Event('resize'))
    await pause()
    check(document.querySelector('.chat-composer')!.getBoundingClientRect().bottom <= 451, 'composer trên bàn phím giả lập')
    check(document.querySelector<HTMLDivElement>('.chat-history')!.clientHeight > 0, 'lịch sử co lại khi bàn phím giả lập')
    const send = document.querySelector<HTMLButtonElement>('.chat-composer button[type="submit"]')!
    send.scrollIntoView({ block: 'nearest' })
    await pause()
    check(send.getBoundingClientRect().bottom <= 451, 'nút Gửi chạm được khi bàn phím giả lập')

    Object.defineProperty(viewport, 'height', { configurable: true, value: 320 })
    frame.style.width = '320px'
    viewport.dispatchEvent(new Event('resize'))
    flushSync(() => showErrors(true))
    await pause()
    const emoji = Array.from(document.querySelectorAll<HTMLButtonElement>('.chat-composer button'))
        .find(button => button.textContent === 'Emoji')!
    emoji.click()
    await pause()
    const composer = document.querySelector<HTMLElement>('.chat-composer')!
    composer.scrollTop = composer.scrollHeight
    await pause()
    check(composer.getBoundingClientRect().bottom <= 321, 'nhiều lỗi + emoji: composer không bị cắt')
    check(send.getBoundingClientRect().bottom <= composer.getBoundingClientRect().bottom + 1
        && send.getBoundingClientRect().top >= composer.getBoundingClientRect().top,
    'nhiều lỗi + emoji: cuộn tới được Gửi')
    Reflect.deleteProperty(viewport, 'height')
    frame.style.width = '394px'
    frame.style.height = '844px'
    flushSync(() => showErrors(false))
    emoji.click()
    viewport.dispatchEvent(new Event('resize'))
    await pause()
    composer.scrollTop = 0
    return 'PASS ' + checks.length + ' kiểm tra CV31: ' + checks.join('; ')
}

run().then(report, error => report('FAIL: ' + error.message + '; đã đạt ' + checks.join('; ')))
function report(result: string) {
    const output = window.parent.document.createElement('pre')
    output.id = 'cv31-result'
    output.textContent = result
    window.parent.document.body.append(output)
}
