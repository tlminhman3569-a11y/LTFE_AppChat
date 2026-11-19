import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { TextRun, TextSize } from '../../types/message'
import { findTextEdit, formatAt, replaceRuns, sliceRuns } from './editRuns'
import type { TextFormat } from './editRuns'
import './rich-text-editor.css'

const sizes: TextSize[] = [12, 14, 16, 18, 24]
const emojis = ['😊', '😂', '❤️', '👍', '🎉', '😢']

interface Props {
    draft: TextRun[]
    onChange: (runs: TextRun[]) => void
    onSend: () => void
    onComposingChange: (composing: boolean) => void
}

export default function RichTextEditor({ draft, onChange, onSend, onComposingChange }: Props) {
    const input = useRef<HTMLDivElement>(null)
    const composing = useRef(false)
    const selection = useRef({ start: 0, end: 0 })
    const beforeInput = useRef<{ start: number; end: number } | null>(null)
    const restore = useRef<{ start: number; end: number } | null>(null)
    const typingFormat = useRef<TextFormat | null>(null)
    // Giữ nội dung đầu tiên cho render HTML; DOM trong editor được đồng bộ ở layout effect.
    const [initialContent] = useState(() => draft.map((run, index) => (
        <span key={index} style={{
            fontWeight: run.bold ? 'bold' : 'normal',
            fontStyle: run.italic ? 'italic' : 'normal',
            fontSize: run.size,
        }}>{run.text}</span>
    )))
    const [toolbar, setToolbar] = useState({
        start: 0, end: 0, typing: null as TextFormat | null,
    })
    const format = toolbar.typing ?? formatAt(draft,
        toolbar.end > toolbar.start ? toolbar.start + 1 : toolbar.start)
    const [showEmoji, setShowEmoji] = useState(false)
    const text = draft.map(run => run.text).join('')

    useLayoutEffect(() => {
        const editor = input.current
        if (!editor || composing.current) return
        const range = restore.current
        const hadFocus = document.activeElement === editor
        editor.replaceChildren(...draft.map(run => {
            const span = document.createElement('span')
            span.textContent = run.text
            span.style.fontWeight = run.bold ? 'bold' : 'normal'
            span.style.fontStyle = run.italic ? 'italic' : 'normal'
            span.style.fontSize = run.size + 'px'
            return span
        }))
        if (draft.at(-1)?.text.endsWith('\n')) editor.append(document.createElement('br'))
        restore.current = null
        if (range) restoreSelection(range)
        else if (hadFocus) restoreSelection(selection.current)
    }, [draft])

    const handleBeforeInput = useEffectEvent((event: InputEvent) => {
        if (event.isComposing || composing.current) return
        beforeInput.current = readSelection()
        recordSelection()
        if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
            event.preventDefault()
            if (event.inputType === 'insertLineBreak') insertText('\n')
            else onSend()
            beforeInput.current = null
        }
    })

    useLayoutEffect(() => {
        const editor = input.current
        if (!editor) return
        const listener = (event: Event) => handleBeforeInput(event as InputEvent)
        editor.addEventListener('beforeinput', listener)
        return () => editor.removeEventListener('beforeinput', listener)
    }, [])

    function readSelection() {
        const editor = input.current
        const selected = window.getSelection()
        if (!editor || !selected?.rangeCount) return selection.current
        const range = selected.getRangeAt(0)
        if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return selection.current
        const prefix = range.cloneRange()
        prefix.selectNodeContents(editor)
        prefix.setEnd(range.startContainer, range.startOffset)
        return { start: prefix.toString().length, end: prefix.toString().length + range.toString().length }
    }

    function restoreSelection(offsets: { start: number; end: number }) {
        const editor = input.current
        if (!editor) return
        editor.focus()
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(true)
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
        let offset = 0
        let foundStart = false
        while (walker.nextNode()) {
            const node = walker.currentNode
            const end = offset + (node.textContent?.length ?? 0)
            if (!foundStart && offsets.start <= end) {
                range.setStart(node, Math.max(0, offsets.start - offset))
                foundStart = true
            }
            if (foundStart && offsets.end <= end) {
                range.setEnd(node, Math.max(0, offsets.end - offset))
                break
            }
            offset = end
        }
        const selected = window.getSelection()
        selected?.removeAllRanges()
        selected?.addRange(range)
    }

    function recordSelection() {
        if (composing.current) return
        const { start, end } = readSelection()
        if (start === selection.current.start && end === selection.current.end && typingFormat.current) return
        selection.current = { start, end }
        typingFormat.current = null
        setToolbar({ start, end, typing: null })
    }

    function readInput() {
        if (composing.current) return
        const editor = input.current
        if (!editor) return
        const value = (editor.textContent ?? '').replace(/\r\n/g, '\n')
        const caret = readSelection()
        const original = beforeInput.current ?? selection.current
        beforeInput.current = null
        const edit = findTextEdit(text, value, caret.end, original)
        const next = typingFormat.current ?? formatAt(draft,
            edit.start + (original.end > original.start ? 1 : 0))
        selection.current = caret
        restore.current = caret
        setToolbar({ start: caret.start, end: caret.end, typing: typingFormat.current })
        onChange(replaceRuns(draft, edit.start, edit.end, [{ ...next, text: edit.text }]))
    }

    function applyFormat(patch: Partial<TextFormat>) {
        const { start, end } = selection.current
        const next = { ...format, ...patch }
        setToolbar({ start, end, typing: start === end ? next : null })
        if (start === end) {
            typingFormat.current = next
            restoreSelection(selection.current)
            return
        }

        const selected = sliceRuns(draft, start, end).map(run => ({ ...run, ...patch }))
        restore.current = { start, end }
        onChange(replaceRuns(draft, start, end, selected))
    }

    function insertText(value: string) {
        const { start, end } = selection.current
        const caret = start + value.length
        const next = typingFormat.current ?? formatAt(draft, start + (end > start ? 1 : 0))
        selection.current = { start: caret, end: caret }
        restore.current = selection.current
        setToolbar({ start: caret, end: caret, typing: typingFormat.current })
        setShowEmoji(false)
        onChange(replaceRuns(draft, start, end, [{ ...next, text: value }]))
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== 'Enter') return
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
        event.preventDefault()
        if (event.shiftKey) insertText('\n')
        else if (!event.repeat) onSend()
    }

    return (
        <div className="rich-text-editor">
            <div className="chat-composer-toolbar" aria-label="Định dạng tin nhắn" role="group">
                <button type="button" aria-label="In đậm" aria-pressed={format.bold}
                    onClick={() => applyFormat({ bold: !format.bold })}>B</button>
                <button type="button" aria-label="In nghiêng" aria-pressed={format.italic}
                    onClick={() => applyFormat({ italic: !format.italic })}>I</button>
                <label>
                    Cỡ chữ
                    <select value={format.size} onChange={event => {
                        const size = sizes.find(value => value === Number(event.currentTarget.value))
                        if (size) applyFormat({ size })
                    }}>
                        {sizes.map(size => <option key={size} value={size}>{size} px</option>)}
                    </select>
                </label>
                <button type="button" aria-expanded={showEmoji} onClick={() => setShowEmoji(value => !value)}>Emoji</button>
            </div>
            {showEmoji && (
                <div className="chat-composer-toolbar" role="group" aria-label="Chọn emoji">
                    {emojis.map(emoji => <button key={emoji} type="button" onClick={() => insertText(emoji)}>{emoji}</button>)}
                </div>
            )}
            <label id="chat-draft-label">Tin nhắn</label>
            <div
                ref={input}
                id="chat-draft"
                className="rich-text-input"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-labelledby="chat-draft-label"
                aria-multiline="true"
                data-placeholder="Soạn tin nhắn"
                onFocus={recordSelection}
                onSelect={recordSelection}
                onKeyUp={recordSelection}
                onMouseUp={recordSelection}
                onBlur={recordSelection}
                onInput={readInput}
                onPaste={event => {
                    event.preventDefault()
                    recordSelection()
                    insertText(event.clipboardData.getData('text/plain'))
                }}
                onDrop={event => { event.preventDefault() }}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { beforeInput.current = null; composing.current = true; onComposingChange(true) }}
                onCompositionEnd={() => {
                    composing.current = false
                    readInput()
                    onComposingChange(false)
                }}
            >{initialContent}</div>
        </div>
    )
}