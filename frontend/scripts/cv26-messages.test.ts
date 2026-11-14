import { afterEach, expect, it, vi } from 'vitest'
import { sendText, subscribeToMessages } from '../src/services/chatApi'
import { socketClient } from '../src/services/socketClient'
import reducer, { markViewed, messageReceived, selectUnreadCount } from '../src/store/slices/messagesSlice'
import { createConversationKey } from '../src/utils/conversationKey'

afterEach(() => vi.restoreAllMocks())

it('gửi đúng loại, đích và nội dung qua socket chung', () => {
    const send = vi.spyOn(socketClient, 'send').mockImplementation(() => {})
    for (const kind of ['people', 'room'] as const) {
        sendText({ kind, name: 'Demo' }, ' Tin mẫu ')
        expect(JSON.parse(send.mock.lastCall![0])).toEqual({
            action: 'onchat',
            data: { event: 'SEND_CHAT', data: { type: kind, to: 'Demo', mes: ' Tin mẫu ' } },
        })
    }
    expect(() => sendText({ kind: 'people', name: 'Demo' }, '  ')).toThrow()
    expect(send).toHaveBeenCalledTimes(2)
})

it('định tuyến tin đến và bỏ qua echo, tin sai người nhận và phản hồi thiếu dữ liệu', () => {
    let emit!: Parameters<typeof socketClient.subscribe>[1]
    const stop = vi.fn()
    const subscribe = vi.spyOn(socketClient, 'subscribe').mockImplementation((event, listener) => {
        expect(event).toBe('SEND_CHAT')
        emit = listener
        return stop
    })
    const onMessage = vi.fn()
    const onError = vi.fn()
    const unsubscribe = subscribeToMessages('current', onMessage, onError)
    const data = { name: 'Demo', to: 'current', mes: 'Tin mẫu', type: 0 }
    emit({ event: 'SEND_CHAT', status: 'success', data })
    emit({ event: 'SEND_CHAT', status: 'success', data: { ...data, name: 'other', to: 'Demo', type: 1 } })
    emit({ event: 'SEND_CHAT', status: 'success', data: { ...data, name: 'current', to: 'Demo' } })
    emit({ event: 'SEND_CHAT', status: 'success', data: { ...data, to: 'other' } })
    emit({ event: 'SEND_CHAT', status: 'success' })
    emit({ event: 'SEND_CHAT', status: 'error' })
    expect(onMessage.mock.calls.map(([conversation]) => conversation)).toEqual([
        { kind: 'people', name: 'Demo' },
        { kind: 'room', name: 'Demo' },
    ])
    expect(onError).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledOnce()
    unsubscribe()
    expect(stop).toHaveBeenCalledOnce()
})

it('đếm chưa xem theo khóa, bỏ qua ID trùng và xóa số đếm khi mở', () => {
    const conversation = { kind: 'people', name: 'Demo' } as const
    const key = createConversationKey(conversation)
    const message = { id: 1, kind: 'people', name: 'Demo', to: 'current', mes: 'Tin mẫu' } as const
    const incoming = messageReceived({ conversation, message, viewed: false })
    let state = reducer(undefined, incoming)
    state = reducer(state, incoming)
    state = reducer(state, messageReceived({ conversation, message: { ...message, id: 2 }, viewed: true }))
    expect(state[key]?.messages).toHaveLength(2)
    expect(selectUnreadCount({ messages: state }, key)).toBe(1)
    expect(selectUnreadCount({ messages: reducer(state, markViewed(key)) }, key)).toBe(0)
})
