import { expect, it } from 'vitest'
import { findTextEdit, replaceRuns, sliceRuns } from '../src/features/editor/editRuns'
import type { TextRun } from '../src/types/message'

const plain: TextRun = { text: 'Chào nhé', bold: false, italic: false, size: 16 }

it('chỉ áp dụng định dạng cho vùng chọn và giữ định dạng khi gõ tiếp', () => {
    const selected = sliceRuns([plain], 0, 4).map(run => ({ ...run, bold: true, size: 18 as const }))
    const formatted = replaceRuns([plain], 0, 4, selected)
    expect(formatted).toEqual([{ ...plain, text: 'Chào', bold: true, size: 18 }, { ...plain, text: ' nhé' }])

    const edit = findTextEdit('Chào nhé', 'Chào nhé 😊', 11)
    expect(replaceRuns(formatted, edit.start, edit.end, [{ ...plain, text: edit.text }])).toEqual([
        { ...plain, text: 'Chào', bold: true, size: 18 }, { ...plain, text: ' nhé 😊' },
    ])
})

it('chèn emoji vào đúng vùng chọn, giữ các đoạn hai bên', () => {
    const runs = [{ ...plain, text: 'abc', italic: true }, { ...plain, text: 'def', bold: true }]
    expect(replaceRuns(runs, 2, 4, [{ ...plain, text: '😊' }])).toEqual([
        { ...plain, text: 'ab', italic: true },
        { ...plain, text: '😊' },
        { ...plain, text: 'ef', bold: true },
    ])
})

it('giữ đúng vị trí định dạng khi thêm ký tự trùng ở giữa', () => {
    expect(findTextEdit('aa', 'aaa', 2)).toEqual({ start: 1, end: 1, text: 'a' })
})

it('thay toàn bộ vùng chọn dù văn bản dán có tiền tố giống nội dung cũ', () => {
    const runs = [{ ...plain, text: 'hello' }, { ...plain, text: 'X', bold: true }]
    const edit = findTextEdit('helloX', 'helloX!', 7, { start: 0, end: 6 })
    expect(edit).toEqual({ start: 0, end: 6, text: 'helloX!' })
    expect(replaceRuns(runs, edit.start, edit.end, [{ ...plain, text: edit.text }])).toEqual([
        { ...plain, text: 'helloX!' },
    ])
})
