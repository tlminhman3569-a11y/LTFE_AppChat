import { useRef } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { ComposerProps } from '../../types/message'
import './composer.css'

export default function Composer({
    conversation, draft, canSend, onDraftChange, onSend,
}: ComposerProps) {
    const composing = useRef(false)
    const text = draft.map(run => run.text).join('')
    const sendDisabled = !canSend || !text.trim()

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (sendDisabled || composing.current) return
        onSend(conversation, draft)
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== 'Enter' || event.shiftKey) return
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return

        event.preventDefault()
        if (!event.repeat && !sendDisabled) onSend(conversation, draft)
    }

    return (
        <form className="chat-composer" onSubmit={handleSubmit}>
            <div className="chat-composer-toolbar" aria-label="Định dạng tin nhắn" role="group">
                <button type="button" disabled aria-label="In đậm">B</button>
                <button type="button" disabled aria-label="In nghiêng">I</button>
                <button type="button" disabled>16 px</button>
                <button type="button" disabled>Emoji</button>
            </div>
            <label htmlFor="chat-draft">Tin nhắn</label>
            <textarea
                id="chat-draft"
                rows={2}
                placeholder="Soạn tin nhắn"
                value={text}
                onChange={event => {
                    const value = event.currentTarget.value
                    onDraftChange(conversation, value ? [{ text: value, bold: false, italic: false, size: 16 }] : [])
                }}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { composing.current = true }}
                onCompositionEnd={() => { composing.current = false }}
            />
            <div className="chat-composer-actions">
                <small>Enter gửi · Shift+Enter xuống dòng</small>
                <button type="submit" disabled={sendDisabled}>Gửi</button>
            </div>
        </form>
    )
}
