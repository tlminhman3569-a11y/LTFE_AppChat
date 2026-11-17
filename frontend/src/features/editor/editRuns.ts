import type { TextRun } from '../../types/message'

export const defaultFormat = { bold: false, italic: false, size: 16 } as const
export type TextFormat = Omit<TextRun, 'text'>

export function formatAt(runs: TextRun[], offset: number): TextFormat {
    let end = 0
    for (const run of runs) {
        end += run.text.length
        if (offset <= end) return { bold: run.bold, italic: run.italic, size: run.size }
    }
    return defaultFormat
}

export function sliceRuns(runs: TextRun[], start: number, end: number): TextRun[] {
    let offset = 0
    return runs.flatMap(run => {
        const from = offset
        offset += run.text.length
        if (offset <= start || from >= end) return []
        const text = run.text.slice(Math.max(0, start - from), end - from)
        return text ? [{ ...run, text }] : []
    })
}

export function replaceRuns(runs: TextRun[], start: number, end: number, replacement: TextRun[]): TextRun[] {
    const next: TextRun[] = []
    for (const run of [...sliceRuns(runs, 0, start), ...replacement, ...sliceRuns(runs, end, Infinity)]) {
        if (!run.text) continue
        const previous = next.at(-1)
        if (previous && previous.bold === run.bold && previous.italic === run.italic && previous.size === run.size) {
            previous.text += run.text
        } else {
            next.push({ ...run })
        }
    }
    return next
}

export function findTextEdit(
    before: string,
    after: string,
    caret: number,
    selection?: { start: number; end: number },
) {
    if (selection && selection.end > selection.start) {
        const { start, end } = selection
        const suffixLength = before.length - end
        const replacementEnd = after.length - suffixLength
        if (replacementEnd >= start && after.startsWith(before.slice(0, start))
            && after.endsWith(before.slice(end))) {
            return { start, end, text: after.slice(start, replacementEnd) }
        }
    }

    // Ưu tiên con trỏ mới để phân biệt vị trí sửa khi các ký tự liền nhau giống nhau.
    let end = before.length
    let afterEnd = after.length
    while (end > 0 && afterEnd > caret && before[end - 1] === after[afterEnd - 1]) {
        end--
        afterEnd--
    }
    let start = 0
    while (start < end && start < afterEnd && before[start] === after[start]) start++
    return { start, end, text: after.slice(start, afterEnd) }
}
