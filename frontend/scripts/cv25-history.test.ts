import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadHistory } from '../src/services/chatApi'
import { store } from '../src/store'
import { connectionStatusChanged, sessionCleared, sessionReconnected, sessionStarted } from '../src/store/slices/authSlice'
import { fetchHistoryPage } from '../src/store/slices/messagesSlice'
import type { ConversationRef } from '../src/types/api'
import type { Message } from '../src/types/message'
import { createConversationKey } from '../src/utils/conversationKey'

vi.mock('../src/services/chatApi', () => ({ loadHistory: vi.fn() }))

const people = { kind: 'people', name: 'demo' } as const
const room = { kind: 'room', name: 'demo' } as const
const read = vi.mocked(loadHistory)
type Reply = Awaited<ReturnType<typeof loadHistory>>

function fetchPage(conversation: ConversationRef, page: number) {
    return store.dispatch(fetchHistoryPage({
        conversation, page, sessionGeneration: store.getState().auth.sessionGeneration,
    }))
}

function history(conversation: ConversationRef) {
    return store.getState().messages[createConversationKey(conversation)]
}

function message(id: number): Message {
    return { id, kind: 'people', name: 'demo', to: 'current', mes: 'Tin mẫu', createAt: `2026-11-13 08:00:0${id}` }
}

function success(conversation: ConversationRef, page: number, messages: Message[]): Reply {
    return { status: 'success', data: { conversation, page, messages } }
}

beforeEach(() => {
    store.dispatch(sessionStarted('current'))
    store.dispatch(connectionStatusChanged('connected'))
})
afterEach(() => read.mockReset())

it('hiển thị cũ đến mới, gộp theo ID, thử lại đúng trang và dừng ở trang rỗng', async () => {
    read.mockResolvedValueOnce(success(people, 1, [message(4), message(3)]))
    await fetchPage(people, 1)
    expect(history(people)?.messages.map(item => item.id)).toEqual([3, 4])

    read.mockResolvedValueOnce({ status: 'error', error: { kind: 'timeout', message: 'Hết thời gian chờ' } })
    await fetchPage(people, 2)
    expect(history(people)).toMatchObject({ nextPage: 2, error: 'Hết thời gian chờ' })
    expect(history(people)?.messages.map(item => item.id)).toEqual([3, 4])

    read.mockResolvedValueOnce(success(people, 2, [message(3), message(2), message(1), message(1)]))
    await fetchPage(people, 2)
    expect(history(people)?.messages.map(item => item.id)).toEqual([1, 2, 3, 4])

    read.mockResolvedValueOnce(success(people, 3, []))
    await fetchPage(people, 3)
    await fetchPage(people, 3)
    expect(history(people)?.hasOlder).toBe(false)
    expect(read).toHaveBeenCalledTimes(4)
})

it('gắn phản hồi trễ vào đúng hội thoại và loại bỏ phản hồi từ phiên cũ', async () => {
    let resolveFirst!: (reply: Reply) => void
    read.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
    const first = fetchPage(people, 1)
    await fetchPage(people, 1)

    const roomMessage = { ...message(2), kind: 'room', to: room.name } as const
    read.mockResolvedValueOnce(success(room, 1, [roomMessage]))
    await fetchPage(room, 1)
    resolveFirst(success(people, 1, [message(1)]))
    await first
    expect(read).toHaveBeenCalledTimes(2)
    expect(history(room)?.messages).toEqual([roomMessage])
    expect(history(people)?.messages).toEqual([message(1)])

    let resolveOld!: (reply: Reply) => void
    read.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
    const old = fetchPage(people, 2)
    store.dispatch(sessionCleared({}))
    store.dispatch(sessionStarted('current'))
    store.dispatch(connectionStatusChanged('connected'))
    read.mockResolvedValueOnce(success(people, 1, [message(4)]))
    await fetchPage(people, 1)
    resolveOld(success(people, 2, [message(2)]))
    await old
    expect(history(people)?.messages).toEqual([message(4)])
})

it('đảo theo thứ tự máy chủ khi tin cùng giây hoặc thiếu thời gian', async () => {
    const sameTime = message(4).createAt
    read.mockResolvedValueOnce(success(people, 1, [
        message(4), { ...message(3), createAt: sameTime }, { ...message(2), createAt: undefined },
    ]))
    await fetchPage(people, 1)
    expect(history(people)?.messages.map(item => item.id)).toEqual([2, 3, 4])
})

it('cho tải lại trang đầu sau reconnect và giữ lịch sử đã có', async () => {
    read.mockResolvedValueOnce(success(room, 1, [{ ...message(2), kind: 'room' }]))
    await fetchPage(room, 1)
    const roomHistory = history(room)

    read.mockResolvedValueOnce({ status: 'error', error: { kind: 'connection', message: 'Mất kết nối' } })
    await fetchPage(people, 1)
    expect(history(people)?.error).toBe('Mất kết nối')

    store.dispatch(sessionReconnected())
    expect(history(people)).toBeUndefined()
    expect(history(room)).toEqual(roomHistory)

    read.mockResolvedValueOnce(success(people, 1, [message(1)]))
    await fetchPage(people, 1)
    expect(history(people)?.messages).toEqual([message(1)])
})
