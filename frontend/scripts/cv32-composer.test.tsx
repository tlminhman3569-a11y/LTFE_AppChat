import { isValidElement } from 'react'
import type { ReactElement, KeyboardEvent, FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import RichTextEditor from '../src/features/editor/RichTextEditor'
import Composer from '../src/features/chat/Composer'
import type { TextRun } from '../src/types/message'

// Kiểm tra callback thật của component, không phải trình duyệt hoặc bộ gõ Windows.
// Ref/state độc lập cho mỗi lần dựng; không chạy effect thao tác DOM trong Node.
vi.mock('react', async importOriginal => ({
    ...await importOriginal<typeof import('react')>(),
    useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => [typeof value === 'function' ? value() : value, () => {}],
    useLayoutEffect: () => {},
    useEffectEvent: (callback: unknown) => callback,
}))

function findElement(tree: unknown, predicate: (node: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> {
    if (Array.isArray(tree)) {
        for (const child of tree) {
            try { return findElement(child, predicate) } catch { /* Tìm tiếp các phần tử cùng cấp. */ }
        }
    } else if (isValidElement<Record<string, unknown>>(tree)) {
        if (predicate(tree)) return tree
        return findElement(tree.props.children, predicate)
    }
    throw new Error('Không tìm thấy phần tử kiểm thử')
}

const run: TextRun = { text: 'Chào tiếng Việt 😊', bold: true, italic: true, size: 18 }
const conversation = { kind: 'people', name: 'peer' } as const

function editor() {
    const onSend = vi.fn()
    const onChange = vi.fn()
    const onComposingChange = vi.fn()
    const tree = RichTextEditor({ draft: [run], onSend, onChange, onComposingChange })
    const input = findElement(tree, node => node.props.role === 'textbox')
    const keydown = input.props.onKeyDown as (event: KeyboardEvent<HTMLDivElement>) => void
    return { input, keydown, onSend, onChange, onComposingChange }
}

function enter(patch: Record<string, unknown> = {}) {
    return { key: 'Enter', shiftKey: false, repeat: false, keyCode: 13,
        nativeEvent: { isComposing: false }, preventDefault: vi.fn(), ...patch } as unknown as KeyboardEvent<HTMLDivElement>
}

describe('CV32 — bàn phím và khóa gửi tại callback component', () => {
    it('Enter gửi một lần; giữ phím không gửi lại', () => {
        const state = editor()
        const event = enter()
        state.keydown(event)
        state.keydown(enter({ repeat: true }))
        expect(state.onSend).toHaveBeenCalledTimes(1)
        expect(event.preventDefault).toHaveBeenCalledOnce()
        expect(state.onChange).not.toHaveBeenCalled()
    })

    it('Shift+Enter thêm xuống dòng và giữ định dạng, không gửi', () => {
        const state = editor()
        state.keydown(enter({ shiftKey: true }))
        expect(state.onSend).not.toHaveBeenCalled()
        expect(state.onChange).toHaveBeenCalledWith([{ ...run, text: '\n' + run.text }])
    })

    it('Enter trong composition hoặc mã 229 không gửi và không ngăn bộ gõ', () => {
        const state = editor()
        const start = state.input.props.onCompositionStart as () => void
        start()
        const composingEnter = enter()
        state.keydown(composingEnter)
        expect(state.onComposingChange).toHaveBeenCalledWith(true)
        expect(composingEnter.preventDefault).not.toHaveBeenCalled()
        expect(state.onSend).not.toHaveBeenCalled()

        for (const event of [enter({ nativeEvent: { isComposing: true } }), enter({ keyCode: 229 })]) {
            const other = editor()
            other.keydown(event)
            expect(other.onSend).not.toHaveBeenCalled()
            expect(event.preventDefault).not.toHaveBeenCalled()
        }
    })

    it('kết thúc composition đọc đủ tiếng Việt và emoji, không gửi tin sớm', () => {
        const state = editor()
        const ref = state.input.props.ref as { current: unknown }
        const value = run.text + ' đang gõ tiếng Việt 🎉'
        ref.current = { textContent: value }
        vi.stubGlobal('window', { getSelection: () => null })
        try {
            ;(state.input.props.onCompositionStart as () => void)()
            ;(state.input.props.onInput as () => void)()
            expect(state.onChange).not.toHaveBeenCalled()
            ;(state.input.props.onCompositionEnd as () => void)()
            expect(state.onChange).toHaveBeenCalledExactlyOnceWith([{ ...run, text: value }])
            expect(state.onComposingChange.mock.calls).toEqual([[true], [false]])
            expect(state.onSend).not.toHaveBeenCalled()
        } finally { vi.unstubAllGlobals() }
    })

    it.each([
        { name: 'offline hoặc hết phiên', canSend: false, draft: [run] },
        { name: 'rỗng', canSend: true, draft: [] },
        { name: 'chỉ khoảng trắng', canSend: true, draft: [{ ...run, text: ' \n ' }] },
        { name: 'vượt byte', canSend: true, draft: [{ ...run, text: '😊'.repeat(200) }] },
    ])('chặn nút Gửi và Enter khi $name, giữ nháp', ({ canSend, draft }) => {
        const onSend = vi.fn()
        const onDraftChange = vi.fn()
        const tree = Composer({ conversation, draft, canSend, onSend, onDraftChange })
        const rich = findElement(tree, node => node.type === RichTextEditor)
        const button = findElement(tree, node => node.type === 'button' && node.props.type === 'submit')
        expect(button.props.disabled).toBe(true)
        ;(tree.props.onSubmit as (event: FormEvent) => void)({ preventDefault: vi.fn() } as unknown as FormEvent)
        ;(rich.props.onSend as () => void)()
        expect(onSend).not.toHaveBeenCalled()
        expect(onDraftChange).not.toHaveBeenCalled()
    })

    it('composition chặn cả submit và Enter; kết thúc composition mới cho gửi', () => {
        const onSend = vi.fn()
        const tree = Composer({ conversation, draft: [run], canSend: true, onSend, onDraftChange: vi.fn() })
        const rich = findElement(tree, node => node.type === RichTextEditor)
        const composing = rich.props.onComposingChange as (value: boolean) => void
        const send = rich.props.onSend as () => void
        const submit = tree.props.onSubmit as (event: FormEvent) => void
        composing(true)
        submit({ preventDefault: vi.fn() } as unknown as FormEvent)
        send()
        expect(onSend).not.toHaveBeenCalled()
        composing(false)
        send()
        expect(onSend).toHaveBeenCalledExactlyOnceWith(conversation, [run])
    })
})
