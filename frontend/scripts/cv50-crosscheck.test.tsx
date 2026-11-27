import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it, vi } from 'vitest'
import type { Message, OutgoingMessage, TextRun } from '../src/types/message'
import type { ConversationRef } from '../src/types/api'
import { createConversationKey } from '../src/utils/conversationKey'
import { serializeRichMessage, parseRichMessage } from '../src/utils/richMessage'
import { matchesOutgoing } from '../src/utils/matchesOutgoing'
import { normalizeRecentConversations } from '../src/utils/normalizeRecentConversations'
import { resolveLookupConversation } from '../src/utils/resolveLookupConversation'
import MessageBubble from '../src/components/MessageBubble'
import ConversationList from '../src/components/ConversationList'

vi.mock('../src/services/chatApi', () => ({ loadHistory: vi.fn() }))
import reducer, {
  fetchHistoryPage, markViewed, messageReceived, outgoingQueued, outgoingErrorReceived,
} from '../src/store/slices/messagesSlice'

const name = 'CV50_CUNG_TEN'
const person: ConversationRef = { kind: 'people', name }
const room: ConversationRef = { kind: 'room', name }
const personKey = createConversationKey(person)
const roomKey = createConversationKey(room)
const user = 'khoi_cv50'
const plain = (text: string, size: TextRun['size'] = 16): TextRun => ({ text, bold: false, italic: false, size })
const message = (conversation: ConversationRef, id: number, mes: string): Message => ({
  id, kind: conversation.kind, name: conversation.name, to: conversation.kind === 'room' ? name : user, mes,
})
function encoded(runs: TextRun[], clientMessageId: string) {
  const result = serializeRichMessage({ version: 1, clientMessageId, runs })
  expect(result.status).toBe('success')
  if (result.status !== 'success') throw new Error(result.error.message)
  return result.data
}

describe('CV50 — định danh hội thoại và lịch sử', () => {
  it('GET_USER_LIST giữ người và phòng cùng tên; chọn username ưu tiên người', () => {
    const result = normalizeRecentConversations([
      { type: 1, name }, { type: 0, name }, { type: 1, name },
    ])
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.data).toHaveLength(2)
    expect(new Set(result.data.map(createConversationKey))).toEqual(new Set([roomKey, personKey]))
    expect(resolveLookupConversation(name, result.data)).toEqual(person)
  })

  it('sidebar render hai nhãn khác nhau cho hai hội thoại có cùng tên', () => {
    const store = configureStore({ reducer: { messages: reducer } })
    const html = renderToStaticMarkup(createElement(Provider, { store, children:
          createElement(ConversationList, {
            conversations: [person, room], selectedConversation: person,
            onSelectConversation: vi.fn(),
          }),
    }))
    expect(html).toContain('Mở chat riêng ' + name)
    expect(html).toContain('Mở phòng ' + name)
    expect(html).toContain('aria-current="true"')
    expect((html.match(/class="cv39-item"/g) ?? [])).toHaveLength(2)
  })

  it('tin, id trùng và unread không lẫn giữa person và room', () => {
    let state = reducer(undefined, { type: 'init' })
    state = reducer(state, messageReceived({ conversation: person, message: message(person, 7, 'Tin cá nhân'), viewed: false }))
    state = reducer(state, messageReceived({ conversation: room, message: message(room, 7, 'Tin phòng'), viewed: false }))
    expect(state[personKey]?.messages.map(m => m.mes)).toEqual(['Tin cá nhân'])
    expect(state[roomKey]?.messages.map(m => m.mes)).toEqual(['Tin phòng'])
    expect(state[personKey]?.unread).toBe(1)
    expect(state[roomKey]?.unread).toBe(1)
    state = reducer(state, markViewed(personKey))
    expect(state[personKey]?.unread).toBe(0)
    expect(state[roomKey]?.unread).toBe(1)
  })

  it('lịch sử trả về muộn của hội thoại trước vẫn ở đúng khóa', () => {
    let state = reducer(undefined, { type: 'init' })
    const a = { conversation: person, page: 1, sessionGeneration: 1 }
    const b = { conversation: room, page: 1, sessionGeneration: 1 }
    state = reducer(state, fetchHistoryPage.pending('a1', a))
    state = reducer(state, fetchHistoryPage.pending('b1', b))
    state = reducer(state, fetchHistoryPage.fulfilled({ status: 'success', data: {
        conversation: room, page: 1, messages: [message(room, 100, 'Phòng đến trước')],
      } }, 'b1', b))
    state = reducer(state, fetchHistoryPage.fulfilled({ status: 'success', data: {
        conversation: person, page: 1, messages: [message(person, 101, 'Người đến sau')],
      } }, 'a1', a))
    expect(state[roomKey]?.messages.map(m => m.mes)).toEqual(['Phòng đến trước'])
    expect(state[personKey]?.messages.map(m => m.mes)).toEqual(['Người đến sau'])
  })

  it('lỗi SEND_CHAT chỉ gắn pending đúng kind/to/mã/nguời gửi', () => {
    const mes = encoded([plain('Cùng chữ')], 'CV50_RECONCILE')
    const own = (conversation: ConversationRef): OutgoingMessage => ({
      localId: 'CV50_RECONCILE', clientMessageId: 'CV50_RECONCILE',
      name: user, to: name, kind: conversation.kind, mes, sentAt: 100, status: 'pending',
    })
    let state = reducer(undefined, { type: 'init' })
    state = reducer(state, outgoingQueued({ conversation: person, message: own(person) }))
    state = reducer(state, outgoingQueued({ conversation: room, message: own(room) }))
    state = reducer(state, outgoingErrorReceived({ ...own(person), id: 42 }))
    expect(state[personKey]?.outgoing?.[0].status).toBe('failed')
    expect(state[roomKey]?.outgoing?.[0].status).toBe('pending')
    expect(matchesOutgoing(own(person), own(room))).toBe(false)
  })
})

describe('CV50 — editor / rich text / hiển thị an toàn', () => {
  it.each([12, 14, 16, 18, 24] as const)('giữ emoji, dấu Việt, bold, italic và cỡ %i qua serializer → parser → bubble', size => {
    const runs: TextRun[] = [
      { text: 'Lời chào 😊\n', bold: true, italic: false, size },
      { text: 'Tiếng Việt 🎉', bold: false, italic: true, size },
    ]
    const mes = encoded(runs, 'CV50_SIZE_' + size)
    expect(parseRichMessage(mes)?.runs).toEqual(runs)
    const html = renderToStaticMarkup(createElement(MessageBubble, { message: message(person, size, mes), currentUser: user }))
    expect(html).toContain('font-size:' + size + 'px')
    expect(html).toContain('font-weight:bold')
    expect(html).toContain('font-style:italic')
    expect(html).toContain('Lời chào 😊')
    expect(html).toContain('Tiếng Việt 🎉')
  })

  it('JSON lỗi hoặc HTML cũ hiển thị text, không tạo img/script', () => {
    const cases = [
      ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;'],
      ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
      ['APPCHAT_RICH_V1{invalid-json', 'APPCHAT_RICH_V1{invalid-json'],
      ['APPCHAT_RICH_V1{invalid-json}', 'APPCHAT_RICH_V1{invalid-json}'],
    ] as const
    for (const [mes, expectedText] of cases) {
      expect(parseRichMessage(mes)).toBeNull()
      const html = renderToStaticMarkup(createElement(MessageBubble, { message: message(person, 999, mes), currentUser: user }))
      expect(html).not.toContain('<img')
      expect(html).not.toContain('<script')
      expect(html).toContain(`<p>${expectedText}</p>`)
    }
  })

  it('hai nội dung trùng chữ nhưng mã khác không được gộp', () => {
    const a = { kind:'people' as const, name:user, to:name, mes:encoded([plain('Một nội dung')],'CV50_A') }
    const b = { ...a, mes: encoded([plain('Một nội dung')],'CV50_B') }
    expect(matchesOutgoing(a, b)).toBe(false)
  })
})
