import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import MessageBubble from '../src/components/MessageBubble'
import Composer from '../src/features/chat/Composer'
import { sendText } from '../src/services/chatApi'
import { socketClient } from '../src/services/socketClient'
import type { TextRun } from '../src/types/message'
import { createMessageId, previewRichMessage, serializeRichMessage } from '../src/utils/richMessage'

const conversation = { kind: 'people', name: 'peer' } as const
const run: TextRun = { text: 'Chào 😊', bold: true, italic: false, size: 16 }

it('gửi mes đã escape, đếm đúng dung lượng và hiển thị nội dung đang chờ', () => {
    const clientMessageId = createMessageId()
    expect(createMessageId()).not.toBe(clientMessageId)
    const encoded = serializeRichMessage({ version: 1, clientMessageId, runs: [run] })
    if (encoded.status !== 'success') throw new Error(encoded.error.message)

    const send = vi.spyOn(socketClient, 'send').mockImplementation(() => {})
    try {
        sendText(conversation, encoded.data)
        expect(JSON.parse(send.mock.calls[0][0])).toEqual({
            action: 'onchat',
            data: { event: 'SEND_CHAT', data: { type: 'people', to: 'peer', mes: encoded.data } },
        })
    } finally {
        send.mockRestore()
    }

    expect(previewRichMessage([run])).toEqual({
        valid: true, remainingBytes: 1900 - Buffer.byteLength(encoded.data),
    })
    const html = renderToStaticMarkup(createElement(MessageBubble, {
        currentUser: 'me', pending: true,
        message: { kind: 'people', name: 'me', to: 'peer', mes: encoded.data, clientMessageId },
    }))
    expect(html).toContain('Chào 😊')
    expect(html).toContain('font-weight:bold')
    expect(html).toContain('Chưa xác nhận')
    expect(html).not.toContain('APPCHAT_RICH_V1')
})

it('chặn gửi trong ô soạn khi Unicode vượt ngưỡng byte', () => {
    const draft = [{ ...run, text: '😊'.repeat(160) }]
    expect(previewRichMessage(draft).valid).toBe(false)
    const html = renderToStaticMarkup(createElement(Composer, {
        conversation, draft, canSend: true, onDraftChange: vi.fn(), onSend: vi.fn(),
    }))
    expect(html).toMatch(/Vượt \d+ byte/)
    expect(html).toContain('<button type="submit" disabled="">Gửi</button>')
})
