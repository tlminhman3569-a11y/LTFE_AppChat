import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MessageBubble from '../src/components/MessageBubble'
import type { RichMessageContent } from '../src/types/message'
import { parseRichMessage, serializeRichMessage } from '../src/utils/richMessage'

const content: RichMessageContent = {
    version: 1,
    clientMessageId: 'cv28-test',
    runs: [{ text: 'Tiếng Việt 😊\n"<b>" \\u263a', bold: true, italic: true, size: 18 }],
}

function renderMessage(mes: string) {
    return renderToStaticMarkup(createElement(MessageBubble, {
        message: { name: 'sender', to: 'receiver', kind: 'people', mes },
        currentUser: 'receiver',
    }))
}

describe('CV28 rich text', () => {
    it('escape DEL và giải mã lại nguyên nội dung', () => {
        const input = { ...content, runs: [{ ...content.runs[0], text: 'a\u007fb' }] }
        const result = serializeRichMessage(input)
        if (result.status !== 'success') throw new Error(result.error.message)

        expect(result.data).toMatch(/^[\x20-\x7e]+$/)
        expect(result.data).toContain('\\u007f')
        expect(parseRichMessage(result.data)).toEqual(input)
    })

    it('từ chối khoảng trắng bên ngoài JSON', () => {
        const json = JSON.stringify(content)
        expect(parseRichMessage('APPCHAT_RICH_V1 ' + json)).toBeNull()
        expect(parseRichMessage('APPCHAT_RICH_V1' + json + '\n')).toBeNull()
    })

    it('escape bên trong mes và giữ nguyên định dạng, emoji, xuống dòng và dấu thoát', () => {
        const result = serializeRichMessage(content)
        if (result.status !== 'success') throw new Error(result.error.message)

        expect(result.data).toMatch(/^APPCHAT_RICH_V1\{[\x20-\x7e]+\}$/)
        expect(result.data).toContain('\\ud83d\\ude0a')
        expect(parseRichMessage(result.data)).toEqual(content)

        const html = renderMessage(result.data)
        expect(html).toContain('font-weight:bold;font-style:italic;font-size:18px')
        expect(html).toContain('Tiếng Việt 😊\n&quot;&lt;b&gt;&quot;')
    })

    it.each([
        'tin cũ <b>hi</b>',
        'APPCHAT_RICH_V1{"version":',
        'APPCHAT_RICH_V1' + JSON.stringify({ ...content, version: 2 }),
        'APPCHAT_RICH_V1' + JSON.stringify({ ...content, clientMessageId: ' ' }),
        'APPCHAT_RICH_V1' + JSON.stringify({ ...content, runs: [{ ...content.runs[0], size: 99 }] }),
        'APPCHAT_RICH_V1' + JSON.stringify({ ...content, runs: [{ ...content.runs[0], bold: 'true' }] }),
    ])('giữ nội dung dạng văn bản khi không giải mã được: %s', mes => {
        expect(parseRichMessage(mes)).toBeNull()
        const html = renderMessage(mes)
        expect(html).toContain('<p>')
        expect(html).not.toContain('<span')
        expect(html).not.toContain('<b>')
    })

    it('đọc JSON phiên bản 1 cũ có Unicode trực tiếp', () => {
        expect(parseRichMessage('APPCHAT_RICH_V1' + JSON.stringify(content))).toEqual(content)
    })

    it('chặn nội dung vượt số ký tự hoặc số đoạn', () => {
        const run = content.runs[0]
        expect(serializeRichMessage({ ...content, runs: [{ ...run, text: 'a'.repeat(1001) }] }).status).toBe('error')
        expect(serializeRichMessage({ ...content, runs: Array.from({ length: 33 }, () => run) }).status).toBe('error')
    })

    it('chấp nhận đúng 1.900 byte và từ chối 1.901 byte sau escape', () => {
        const run = { ...content.runs[0], text: '' }
        const overhead = ('APPCHAT_RICH_V1' + JSON.stringify({ ...content, runs: [run] })).length
        const text = 'ệ'.repeat(Math.floor((1900 - overhead) / 6)) + 'a'.repeat((1900 - overhead) % 6)
        const result = serializeRichMessage({ ...content, runs: [{ ...run, text }] })

        expect(result.status).toBe('success')
        if (result.status === 'success') expect(result.data).toHaveLength(1900)
        expect(serializeRichMessage({ ...content, runs: [{ ...run, text: text + 'a' }] }).status).toBe('error')
    })
})
