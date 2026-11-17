import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { TextRun, TextSize } from '../../types/message'
import { defaultFormat, findTextEdit, formatAt, replaceRuns, sliceRuns } from './editRuns'
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
    const input = useRef<HTMLTextAreaElement>(null)
    const composing = useRef(false)
    const selection = useRef({ start: 0, end: 0 })
    const restore = useRef<{ start: number; end: number } | null>(null)
    const typingFormat = useRef<TextFormat | null>(null)
    const [format, setFormat] = useState<TextFormat>(defaultFormat)
    const [showEmoji, setShowEmoji] = useState(false)
    const text = draft.map(run => run.text).join('')

    useLayoutEffect(() => {
        const range = restore.current
        if (!range) return
        restore.current = null
        input.current?.focus()
        input.current?.setSelectionRange(range.start, range.end)
    }, [draft])

    function recordSelection(element: HTMLTextAreaElement) {
        const { selectionStart: start, selectionEnd: end } = element
        if (start === selection.current.start && end === selection.current.end) return
        selection.current = { start, end }
        typingFormat.current = null
        setFormat(formatAt(draft, end > start ? start + 1 : start))
    }

    function applyFormat(patch: Partial<TextFormat>) {
        const { start, end } = selection.current
        const next = { ...format, ...patch }
        setFormat(next)
        if (start === end) {
            typingFormat.current = next
            input.current?.focus()
            return
        }

        const selected = sliceRuns(draft, start, end).map(run => ({ ...run, ...patch }))
        restore.current = { start, end }
        onChange(replaceRuns(draft, start, end, selected))
    }

    function insertEmoji(emoji: string) {
        const { start, end } = selection.current
        const caret = start + emoji.length
        const next = typingFormat.current ?? formatAt(draft, start)
        selection.current = { start: caret, end: caret }
        restore.current = selection.current
        setShowEmoji(false)
        onChange(replaceRuns(draft, start, end, [{ ...next, text: emoji }]))
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== 'Enter' || event.shiftKey) return
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
        event.preventDefault()
        if (!event.repeat) onSend()
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
                    {emojis.map(emoji => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>{emoji}</button>)}
                </div>
            )}
            <label htmlFor="chat-draft">Tin nhắn</label>
            <textarea
                ref={input}
                id="chat-draft"
                rows={2}
                placeholder="Soạn tin nhắn"
                value={text}
                onSelect={event => recordSelection(event.currentTarget)}
                onChange={event => {
                    const { value, selectionStart, selectionEnd } = event.currentTarget
                    const edit = findTextEdit(text, value, selectionEnd, selection.current)
                    const next = typingFormat.current ?? formatAt(draft, edit.start + (selection.current.end > selection.current.start ? 1 : 0))
                    selection.current = { start: selectionStart, end: selectionEnd }
                    setFormat(next)
                    onChange(replaceRuns(draft, edit.start, edit.end, [{ ...next, text: edit.text }]))
                }}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { composing.current = true; onComposingChange(true) }}
                onCompositionEnd={() => { composing.current = false; onComposingChange(false) }}
            />
            {text && (
                <div className="rich-text-preview" role="region" aria-label="Xem trước định dạng">
                    {draft.map((run, index) => (
                        <span key={index} style={{
                            fontWeight: run.bold ? 'bold' : 'normal',
                            fontStyle: run.italic ? 'italic' : 'normal',
                            fontSize: run.size,
                        }}>{run.text}</span>
                    ))}
                </div>
            )}
        </div>
    )
}
