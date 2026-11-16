import type { ApiResult } from '../types/api'
import type { RichMessageContent, TextRun, TextSize } from '../types/message'

const prefix = 'APPCHAT_RICH_V1'
const sizes: ReadonlySet<unknown> = new Set<TextSize>([12, 14, 16, 18, 24])
const maxTextUnits = 1000
const maxRuns = 32
const maxMesBytes = 1900

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTextRun(value: unknown): value is TextRun {
    return isRecord(value)
        && typeof value.text === 'string'
        && typeof value.bold === 'boolean'
        && typeof value.italic === 'boolean'
        && sizes.has(value.size)
}

function isRichMessage(value: unknown): value is RichMessageContent {
    return isRecord(value)
        && value.version === 1
        && typeof value.clientMessageId === 'string'
        && value.clientMessageId.trim().length > 0
        && Array.isArray(value.runs)
        && value.runs.length > 0
        && value.runs.every(isTextRun)
}

export function parseRichMessage(mes: string): RichMessageContent | null {
    if (!mes.startsWith(prefix)) return null

    const json = mes.slice(prefix.length)
    if (!json.startsWith('{') || !json.endsWith('}')) return null

    try {
        const value: unknown = JSON.parse(json)
        return isRichMessage(value) ? value : null
    } catch {
        return null
    }
}

function encodingError(message: string): ApiResult<never> {
    return { status: 'error', error: { kind: 'business', message } }
}

export function serializeRichMessage(content: RichMessageContent): ApiResult<string> {
    if (!isRichMessage(content)) return encodingError('Định dạng tin nhắn không hợp lệ.')

    const { clientMessageId, runs } = content
    if (runs.length > maxRuns) return encodingError('Tin nhắn có quá nhiều đoạn định dạng.')

    const text = runs.map(run => run.text).join('')
    if (!text.trim()) return encodingError('Vui lòng nhập nội dung tin nhắn.')
    if (text.length > maxTextUnits) return encodingError('Tin nhắn quá dài. Vui lòng rút ngắn.')

    const json = JSON.stringify({
        version: 1,
        clientMessageId,
        runs: runs.map(({ text, bold, italic, size }) => ({ text, bold, italic, size })),
    })
    const ascii = json.replace(/[\u007f-\uffff]/g, unit =>
        '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'),
    )
    const mes = prefix + ascii

    // Sau escape, mỗi ký tự ASCII chiếm đúng một byte UTF-8.
    if (mes.length > maxMesBytes) return encodingError('Tin nhắn vượt giới hạn 1.900 byte. Vui lòng rút ngắn.')

    return { status: 'success', data: mes }
}
