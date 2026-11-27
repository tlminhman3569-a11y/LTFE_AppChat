import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { store } from '../src/store'
import { loadHistory } from '../src/services/chatApi'
import { useChat } from '../src/hooks/useChat'
import { connectionStatusChanged, sessionReconnected, sessionStarted } from '../src/store/slices/authSlice'
import { fetchHistoryPage, messageReceived, outgoingQueued, reconcileOutgoing } from '../src/store/slices/messagesSlice'
import ChatPage from '../src/features/chat/ChatPage'
import { createConversationKey } from '../src/utils/conversationKey'
import { serializeRichMessage } from '../src/utils/richMessage'
import type { ConversationRef } from '../src/types/api'
import type { Message } from '../src/types/message'

const effects = vi.hoisted(() => ({ callbacks: [] as (() => void)[] }))
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(),
    useEffect: (callback: () => void) => effects.callbacks.push(callback),
}))
vi.mock('../src/store/hooks', () => ({
    useAppDispatch: () => store.dispatch,
    useAppSelector: <T>(selector: (state: ReturnType<typeof store.getState>) => T) => selector(store.getState()),
}))
vi.mock('../src/services/chatApi', () => ({ loadHistory: vi.fn() }))

const people = { kind: 'people', name: 'peer' } as const
const room = { kind: 'room', name: 'peer' } as const
const read = vi.mocked(loadHistory)
type Reply = Awaited<ReturnType<typeof loadHistory>>
const history = (conversation: ConversationRef = people) => store.getState().messages[createConversationKey(conversation)]!
const message = (id: number): Message => ({ id, kind: 'people', name: 'peer', to: 'me', mes: 'Tin ' + id })
function success(conversation: ConversationRef, page: number, messages: Message[]): Reply {
    return { status: 'success', data: { conversation, page, messages } }
}
function fetchPage(conversation: ConversationRef, page: number, refresh = false) {
    return store.dispatch(fetchHistoryPage({ conversation, page, refresh,
        sessionGeneration: store.getState().auth.sessionGeneration }))
}
async function seed(conversation: ConversationRef = people, messages: Message[] = [message(3)]) {
    read.mockResolvedValueOnce(success(conversation, 1, messages))
    await fetchPage(conversation, 1)
    read.mockClear()
}
function HookProbe({ conversation }: { conversation: ConversationRef }) {
    return useChat(conversation)
}
function runHistoryEffect(conversation: ConversationRef = people) {
    effects.callbacks = []
    const result = HookProbe({ conversation })
    // Chạy callback effect của hook thật; không thay thế kiểm tra DOM/cuộn trên browser.
    for (const callback of effects.callbacks) callback()
    return result
}
beforeEach(() => {
    store.dispatch(sessionStarted('me'))
    store.dispatch(connectionStatusChanged('connected'))
})
afterEach(() => { read.mockReset(); effects.callbacks = [] })

it('cache không có pending tự đọc bù nhiều trang sau reconnect, giữ các trang cũ', async () => {
    await seed(people, [message(3), message(2)])
    read.mockResolvedValueOnce(success(people, 2, [message(1)]))
    await fetchPage(people, 2)
    read.mockClear()
    store.dispatch(connectionStatusChanged('disconnected'))
    runHistoryEffect()
    expect(read).not.toHaveBeenCalled()
    read.mockResolvedValueOnce(success(people, 1, [message(6), message(5)]))
        .mockResolvedValueOnce(success(people, 2, [message(4), message(3)]))
    store.dispatch(sessionReconnected())
    runHistoryEffect()
    await vi.waitFor(() => expect(history().needsRefresh).toBe(false))
    expect(read.mock.calls.map(call => call[1])).toEqual([1, 2])
    expect(history().messages.map(item => item.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(history()).toMatchObject({ nextPage: 3, hasOlder: true, error: '' })
    expect(history().outgoing?.length ?? 0).toBe(0)
})

it('cache đã báo hết lịch sử vẫn làm mới được, không đổi con trỏ tải tin cũ', async () => {
    await seed()
    read.mockResolvedValueOnce(success(people, 2, []))
    await fetchPage(people, 2)
    store.dispatch(sessionReconnected())
    read.mockResolvedValueOnce(success(people, 1, [message(4), message(3)]))
    await fetchPage(people, 1, true)
    expect(history()).toMatchObject({ nextPage: 2, hasOlder: false, needsRefresh: false })
    expect(history().messages.map(item => item.id)).toEqual([3, 4])
})

it('làm mới lỗi giữ cache, không tự lặp request; nút tải lại đọc từ trang 1', async () => {
    await seed()
    store.dispatch(sessionReconnected())
    read.mockResolvedValueOnce({ status: 'error', error: { kind: 'timeout', message: 'Hết thời gian chờ' } })
    await fetchPage(people, 1, true)
    expect(history()).toMatchObject({ needsRefresh: true, error: 'Hết thời gian chờ', nextPage: 2 })
    expect(history().messages.map(item => item.id)).toEqual([3])
    read.mockClear()
    const hook = runHistoryEffect()
    expect(read).not.toHaveBeenCalled()
    read.mockResolvedValueOnce(success(people, 1, [message(4), message(3)]))
    hook.loadNextPage()
    await vi.waitFor(() => expect(history().needsRefresh).toBe(false))
    expect(read).toHaveBeenCalledWith(people, 1, 'me')
    expect(history().messages.map(item => item.id)).toEqual([3, 4])
})

it('tin realtime trong lúc tải không làm dừng đọc bù sớm hoặc tạo bản trùng', async () => {
    await seed()
    store.dispatch(sessionReconnected())
    let resolve!: (reply: Reply) => void
    read.mockReturnValueOnce(new Promise(done => { resolve = done }))
        .mockResolvedValueOnce(success(people, 2, [message(4), message(3)]))
    const loading = fetchPage(people, 1, true)
    store.dispatch(messageReceived({ conversation: people, message: message(6), viewed: true }))
    resolve(success(people, 1, [message(6), message(5)]))
    await loading
    expect(read).toHaveBeenCalledTimes(2)
    expect(history().messages.map(item => item.id)).toEqual([3, 4, 5, 6])
})

it('reconnect lần nữa bỏ phản hồi lượt cũ, không ghi sang phòng trùng tên', async () => {
    await seed()
    await seed(room, [{ ...message(9), kind: 'room', to: 'peer' }])
    store.dispatch(sessionReconnected())
    let resolve!: (reply: Reply) => void
    read.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const old = fetchPage(people, 1, true)
    store.dispatch(sessionReconnected())
    read.mockResolvedValueOnce(success(people, 1, [message(4), message(3)]))
    await fetchPage(people, 1, true)
    resolve(success(people, 1, [message(99), message(3)]))
    await old
    expect(history().messages.map(item => item.id)).toEqual([3, 4])
    expect(history(room).messages.map(item => item.id)).toEqual([9])
    expect(history(room).needsRefresh).toBe(true)
})

it('trang làm mới nhận cả tin đến lẫn bản lưu pending, không cần gửi lại', async () => {
    await seed()
    const encoded = serializeRichMessage({ version: 1, clientMessageId: 'cv25-reconnect', runs: [
        { text: 'Tin của mình', bold: false, italic: false, size: 16 },
    ] })
    if (encoded.status !== 'success') throw new Error('Mẫu không hợp lệ')
    const own = { kind: 'people' as const, name: 'me', to: 'peer', mes: encoded.data, clientMessageId: 'cv25-reconnect' }
    store.dispatch(outgoingQueued({ conversation: people, message: {
        ...own, localId: 'cv25-reconnect', status: 'unconfirmed', sentAt: 1,
    } }))
    store.dispatch(sessionReconnected())
    read.mockResolvedValueOnce(success(people, 1, [{ ...own, id: 5, deliveryStatus: 'saved' }, message(4), message(3)]))
    await fetchPage(people, 1, true)
    expect(history().outgoing).toEqual([])
    expect(history().messages.map(item => item.id)).toEqual([3, 4, 5])
    expect(history().messages.at(-1)?.deliveryStatus).toBe('saved')
})

it('máy chủ lặp trang thì dừng, giữ cache và cho thử lại', async () => {
    await seed()
    store.dispatch(sessionReconnected())
    const page = [message(6), message(5)]
    read.mockResolvedValueOnce(success(people, 1, page)).mockResolvedValueOnce(success(people, 2, page))
    await fetchPage(people, 1, true)
    expect(read).toHaveBeenCalledTimes(2)
    expect(history().needsRefresh).toBe(true)
    expect(history().error).toContain('lặp trang')
    expect(history().messages.map(item => item.id)).toEqual([3])
})

it('vẫn có nút thử cập nhật khi cache đã hết lịch sử và refresh bị lỗi', async () => {
    await seed()
    read.mockResolvedValueOnce(success(people, 2, []))
    await fetchPage(people, 2)
    store.dispatch(sessionReconnected())
    read.mockResolvedValueOnce({ status: 'error', error: { kind: 'timeout', message: 'Timeout refresh' } })
    await fetchPage(people, 1, true)
    expect(history().hasOlder).toBe(false)
    const html = renderToStaticMarkup(createElement(ChatPage, {
        conversation: people, conversationKey: createConversationKey(people), currentUser: 'me',
        authStatus: 'authenticated', connectionStatus: 'connected', sessionGeneration: store.getState().auth.sessionGeneration,
        draft: [], canSend: true, pending: [], sendError: '', onDraftChange: vi.fn(), onSend: vi.fn(), onBack: vi.fn(),
    }))
    expect(html).toContain('>Thử cập nhật lịch sử</button>')
    expect(html).toContain('Timeout refresh')
})

it('hòa giải pending đến sau không xóa lỗi refresh hoặc kích hoạt vòng tải lại', async () => {
    await seed()
    store.dispatch(outgoingQueued({ conversation: people, message: {
        kind: 'people', name: 'me', to: 'peer', mes: 'Đang chờ', localId: 'pending', sentAt: 1, status: 'unconfirmed',
    } }))
    store.dispatch(sessionReconnected())
    let finishRefresh!: (reply: Reply) => void
    let finishReconcile!: (reply: Reply) => void
    read.mockReturnValueOnce(new Promise(done => { finishRefresh = done }))
        .mockReturnValueOnce(new Promise(done => { finishReconcile = done }))
    const refreshing = fetchPage(people, 1, true)
    const reconciling = store.dispatch(reconcileOutgoing({ conversation: people,
        sessionGeneration: store.getState().auth.sessionGeneration }))
    finishRefresh({ status: 'error', error: { kind: 'timeout', message: 'Timeout refresh' } })
    await refreshing
    finishReconcile(success(people, 1, []))
    await reconciling
    expect(history().error).toBe('Timeout refresh')
    read.mockClear()
    runHistoryEffect()
    expect(read).not.toHaveBeenCalled()
})
