import type { Message, TextRun } from '../types/message'
import { parseRichMessage } from './richMessage'

export function matchesOutgoing(pending: Message, stored: Message): boolean {
    if (pending.kind !== stored.kind || pending.name !== stored.name || pending.to !== stored.to) return false
    const a = parseRichMessage(pending.mes)
    const b = parseRichMessage(stored.mes)
    if (!a || !b || a.clientMessageId !== b.clientMessageId) return false
    return sameTextRuns(a.runs, b.runs)
}

export function sameTextRuns(first: TextRun[], second: TextRun[]): boolean {
    return first.length === second.length && first.every((run, index) => {
        const other = second[index]
        return run.text === other.text && run.bold === other.bold && run.italic === other.italic && run.size === other.size
    })
}