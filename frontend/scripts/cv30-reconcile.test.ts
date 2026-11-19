import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { store } from '../src/store'
import {
    messageReceived, outgoingQueued, outgoingSendFailed, outgoingExpired, outgoingErrorReceived, reconcileOutgoing, fetchHistoryPage,
} from '../src/store/slices/messagesSlice'
import { sessionCleared, sessionStarted, connectionStatusChanged, sessionReconnected } from '../src/store/slices/authSlice'
import type { OutgoingMessage } from '../src/types/message'
import { createConversationKey } from '../src/utils/conversationKey'
import { serializeRichMessage } from '../src/utils/richMessage'
import { matchesOutgoing } from '../src/utils/matchesOutgoing'
import { socketClient } from '../src/services/socketClient'
import { subscribeToMessages } from '../src/services/chatApi'

const conversation = { kind: 'people', name: 'peer' } as const
const key = createConversationKey(conversation)
function queued(id = 'one'): OutgoingMessage {
    const encoded = serializeRichMessage({ version: 1, clientMessageId: id,
        runs: [{ text: 'Nội dung giống nhau 😊', bold: true, italic: false, size: 18 }] })
    if (encoded.status !== 'success') throw new Error(encoded.error.message)
    return { localId: id, clientMessageId: id, name: 'me', to: 'peer', kind: 'people',
        mes: encoded.data, status: 'pending', sentAt: 100 }
}
function enqueue(id = 'one') {
    const message = queued(id)
    store.dispatch(outgoingQueued({ conversation, message }))
    return message
}
function history() { return store.getState().messages[key]! }
const generation = () => store.getState().auth.sessionGeneration

beforeEach(() => {
    store.dispatch(sessionCleared({}))
    store.dispatch(sessionStarted('me'))
    store.dispatch(connectionStatusChanged('connected'))
})
afterEach(() => vi.restoreAllMocks())

it('không ghép chỉ vì nội dung giống nhau, sai người gửi, đích hoặc loại hội thoại', () => {
    const a = queued()
    expect(matchesOutgoing(a, queued('two'))).toBe(false)
    expect(matchesOutgoing(a, { ...a, name: 'attacker' })).toBe(false)
    expect(matchesOutgoing(a, { ...a, to: 'someone' })).toBe(false)
    expect(matchesOutgoing(a, { ...a, kind: 'room' })).toBe(false)
    expect(matchesOutgoing(a, { ...a, mes: a.mes.replace('N', 'X') })).toBe(false)
    expect(matchesOutgoing(a, { ...a, id: 12 })).toBe(true)
})

it('timeout và reconnect giữ nội dung, không tự tạo tin đã lưu hoặc gửi lại', () => {
    enqueue()
    const send = vi.spyOn(socketClient, 'send')
    store.dispatch(outgoingExpired(101))
    store.dispatch(sessionReconnected())
    expect(history().outgoing![0]).toMatchObject({ status: 'unconfirmed', mes: queued().mes })
    expect(history().messages).toEqual([])
    expect(send).not.toHaveBeenCalled()
})

it('chỉ lỗi đầy đủ khớp tin mới chuyển sang thất bại', () => {
    const a = enqueue()
    enqueue('two')
    store.dispatch(outgoingErrorReceived({ ...a, name: 'attacker' }))
    expect(history().outgoing!.map(m => m.status)).toEqual(['pending', 'pending'])
    store.dispatch(outgoingErrorReceived(a))
    expect(history().outgoing!.map(m => m.status)).toEqual(['failed', 'pending'])
})

it('đối chiếu lịch sử chuyển đúng tin, giữ hai tin cùng chữ và không lặp khi tải lại', async () => {
    const a = enqueue()
    enqueue('two')
    const raw = { ...a, type: 0, id: 12, createAt: '2026-11-18 01:00:00' }
    vi.spyOn(socketClient, 'request')
        .mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [raw] })
        .mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [] })
        .mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [raw] })
    await store.dispatch(reconcileOutgoing({ conversation, sessionGeneration: generation() }))
    expect(history().outgoing!.map(m => m.localId)).toEqual(['two'])
    expect(history().messages).toHaveLength(1)
    expect(history().messages[0]).toMatchObject({ id: 12, deliveryStatus: 'saved', clientMessageId: 'one' })
    await store.dispatch(fetchHistoryPage({ conversation, page: 1, sessionGeneration: generation() }))
    expect(history().messages).toHaveLength(1)
})

it('phản hồi lịch sử đến sau khi đổi phiên không phục hồi tin cũ', async () => {
    const a = enqueue()
    let resolve!: (value: Awaited<ReturnType<typeof socketClient.request>>) => void
    const req = vi.spyOn(socketClient, 'request').mockImplementation(() => new Promise(r => { resolve = r }))
    const pending = store.dispatch(reconcileOutgoing({ conversation, sessionGeneration: generation() }))
    store.dispatch(sessionCleared({}))
    store.dispatch(sessionStarted('other'))
    resolve({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [{ ...a, type: 0, id: 12 }] })
    await pending
    expect(store.getState().messages).toEqual({})
    expect(req).toHaveBeenCalledTimes(1)
})

it('không gộp hai bản ghi có ID máy chủ khác nhau dù clientMessageId và nội dung giống', async () => {
    const a = enqueue()
    vi.spyOn(socketClient, 'request')
        .mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [
            { ...a, type: 0, id: 13 }, { ...a, type: 0, id: 12 },
        ] })
        .mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [] })
    await store.dispatch(reconcileOutgoing({ conversation, sessionGeneration: generation() }))
    expect(history().messages.map(m => m.id)).toEqual([12, 13])
    expect(history().outgoing).toEqual([])
})

it('tin tự gửi realtime chỉ báo để đối chiếu, lỗi thiếu khóa báo chung', () => {
    let listener!: Parameters<typeof socketClient.subscribe>[1]
    vi.spyOn(socketClient, 'subscribe').mockImplementation((_event, callback) => {
        listener = callback
        return () => {}
    })
    const own = vi.fn(), incoming = vi.fn(), error = vi.fn()
    subscribeToMessages('me', incoming, error, own)
    const a = queued()
    listener({ event: 'SEND_CHAT', status: 'success', data: { ...a, type: 0, id: 99 } })
    expect(own).toHaveBeenCalledOnce()
    expect(incoming).not.toHaveBeenCalled()
    expect(own.mock.calls[0][1]).toMatchObject({ clientMessageId: 'one' })
    listener({ event: 'SEND_CHAT', status: 'error', mes: 'Unknown result' })
    expect(error).toHaveBeenCalledWith(undefined)
})

it('đọc lịch sử lỗi không xóa tin chờ', async () => {
    enqueue()
    vi.spyOn(socketClient, 'request').mockRejectedValue(new Error('offline'))
    await store.dispatch(reconcileOutgoing({ conversation, sessionGeneration: generation() }))
    expect(history().outgoing).toHaveLength(1)
    expect(history().messages).toEqual([])
})

it('tin realtime đến lúc đối chiếu vẫn ở đúng vị trí cuối', () => {
    const a = enqueue()
    const b = { ...a, id: 2, mes: 'B' }
    const c = { ...a, id: 3, mes: 'C', name: 'peer', to: 'me' }
    const arg = { conversation, sessionGeneration: generation() }
    store.dispatch(fetchHistoryPage.pending('initial', { ...arg, page: 1 }))
    store.dispatch(fetchHistoryPage.fulfilled({
        status: 'success', data: { conversation, page: 1, messages: [b, { ...a, id: 1 }] },
    }, 'initial', { ...arg, page: 1 }))
    enqueue('later')
    store.dispatch(reconcileOutgoing.pending('check', arg))
    store.dispatch(messageReceived({ conversation, message: c, viewed: true }))
    store.dispatch(reconcileOutgoing.fulfilled({
        status: 'success', data: { conversation, page: 1, messages: [b, { ...a, id: 1 }] },
    }, 'check', arg))
    expect(history().messages.map(message => message.id)).toEqual([1, 2, 3])
})

it('bản lưu mới được chèn trước tin đến trong lúc chờ và xóa thông báo lỗi cũ', () => {
    const a = enqueue()
    const arg = { conversation, sessionGeneration: generation() }
    store.dispatch(fetchHistoryPage.pending('initial', { ...arg, page: 1 }))
    store.dispatch(fetchHistoryPage.rejected(new Error('offline'), 'initial', { ...arg, page: 1 }))
    store.dispatch(reconcileOutgoing.pending('check', arg))
    store.dispatch(messageReceived({
        conversation, message: { ...a, name: 'peer', to: 'me', id: 3, mes: 'Tin mới' }, viewed: true,
    }))
    store.dispatch(reconcileOutgoing.fulfilled({
        status: 'success', data: { conversation, page: 1, messages: [{ ...a, id: 1, deliveryStatus: 'saved' }] },
    }, 'check', arg))
    expect(history().messages.map(message => message.id)).toEqual([1, 3])
    expect(history().error).toBe('')
    expect(history().outgoing).toEqual([])
})

it('phản hồi thiếu ID và giờ không làm mất metadata máy chủ đã có hoặc tạo tin trùng', () => {
    const a = enqueue()
    const arg = { conversation, sessionGeneration: generation() }
    const saved = { ...a, id: 12, createAt: '2026-11-18 01:00:00' }
    store.dispatch(fetchHistoryPage.pending('initial', { ...arg, page: 1 }))
    store.dispatch(fetchHistoryPage.fulfilled({
        status: 'success', data: { conversation, page: 1, messages: [saved] },
    }, 'initial', { ...arg, page: 1 }))
    enqueue('two')
    store.dispatch(reconcileOutgoing.pending('check', arg))
    store.dispatch(reconcileOutgoing.fulfilled({
        status: 'success', data: { conversation, page: 1, messages: [{ ...a, deliveryStatus: 'saved' }] },
    }, 'check', arg))
    expect(history().messages[0]).toMatchObject({ id: 12, createAt: saved.createAt })
    store.dispatch(fetchHistoryPage.pending('older', { ...arg, page: 2 }))
    store.dispatch(fetchHistoryPage.fulfilled({
        status: 'success', data: { conversation, page: 2, messages: [saved] },
    }, 'older', { ...arg, page: 2 }))
    expect(history().messages).toHaveLength(1)
})

it('không cần ID của tin cuối để giữ tin đến sau snapshot ở cuối', () => {
    const a = enqueue()
    const arg = { conversation, sessionGeneration: generation() }
    store.dispatch(messageReceived({
        conversation, message: { ...a, id: undefined, mes: 'B', clientMessageId: undefined }, viewed: true,
    }))
    // Tin không có ID chỉ được thêm sau khi trang đầu đã tải.
    store.dispatch(fetchHistoryPage.pending('initial', { ...arg, page: 1 }))
    store.dispatch(fetchHistoryPage.fulfilled({
        status: 'success', data: { conversation, page: 1, messages: [{ ...a, id: undefined, mes: 'B' }] },
    }, 'initial', { ...arg, page: 1 }))
    store.dispatch(reconcileOutgoing.pending('check', arg))
    store.dispatch(messageReceived({
        conversation, message: { ...a, id: 3, mes: 'C', name: 'peer', to: 'me' }, viewed: true,
    }))
    store.dispatch(reconcileOutgoing.fulfilled({
        status: 'success', data: { conversation, page: 1, messages: [{ ...a, id: 2 }] },
    }, 'check', arg))
    expect(history().messages.map(message => message.mes)).toEqual(['B', a.mes, 'C'])
})

it('thử lại cùng mã chỉ có một tin tạm, lỗi lần cũ không kết luận lần mới thất bại', () => {
    const a = enqueue()
    store.dispatch(outgoingExpired(Date.now()))
    store.dispatch(outgoingQueued({ conversation, message: { ...a, status: 'pending', sentAt: 200 } }))
    expect(history().outgoing).toHaveLength(1)
    expect(history().outgoing![0]).toMatchObject({ clientMessageId: a.clientMessageId, status: 'pending', attempts: 2 })
    store.dispatch(outgoingErrorReceived(a))
    expect(history().outgoing![0].status).toBe('unconfirmed')
})

it('so sánh nội dung retry không phụ thuộc thứ tự key trong JSON', () => {
    const a = queued()
    const raw = JSON.parse(a.mes.slice('APPCHAT_RICH_V1'.length))
    raw.runs = raw.runs.map((run: { text: string; bold: boolean; italic: boolean; size: number }) => ({
        size: run.size, italic: run.italic, text: run.text, bold: run.bold,
    }))
    expect(matchesOutgoing(a, { ...a, mes: 'APPCHAT_RICH_V1' + JSON.stringify(raw) })).toBe(true)
})

it('đối chiếu lỗi có thông báo riêng, giữ tin và không gán lỗi lịch sử thường', async () => {
    enqueue()
    vi.spyOn(socketClient, 'request').mockRejectedValue(new Error('timeout'))
    await store.dispatch(reconcileOutgoing({ conversation, sessionGeneration: generation() }))
    expect(history().reconcileError).toBeTruthy()
    expect(history().error).toBe('')
    expect(history().outgoing).toHaveLength(1)
})

it('gửi lại lỗi đồng bộ vẫn giữ chưa xác nhận nếu lần trước có thể đã lưu', () => {
    const a = enqueue()
    store.dispatch(outgoingExpired(Date.now()))
    store.dispatch(outgoingQueued({ conversation, message: { ...a, status: 'pending', sentAt: 200 } }))
    store.dispatch(outgoingSendFailed({ conversation, localId: a.localId }))
    expect(history().outgoing![0]).toMatchObject({ status: 'unconfirmed', attempts: 2 })
})