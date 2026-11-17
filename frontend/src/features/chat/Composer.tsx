import type { FormEvent } from 'react'
import type { ComposerProps } from '../../types/message'
import { previewRichMessage } from '../../utils/richMessage'
import RichTextEditor from '../editor/RichTextEditor'
import './composer.css'

export default function Composer({
    conversation, draft, canSend, onDraftChange, onSend,
}: ComposerProps) {
    const text = draft.map(run => run.text).join('')
    const preview = previewRichMessage(draft)
    const sendDisabled = !canSend || !preview.valid

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (sendDisabled) return
        onSend(conversation, draft)
    }

    return (
        <form className="chat-composer" onSubmit={handleSubmit}>
            <RichTextEditor
                draft={draft}
                onChange={runs => onDraftChange(conversation, runs)}
                onSend={() => { if (!sendDisabled) onSend(conversation, draft) }}
            />
            {draft.length > 0 && <small>Đang giữ bản nháp cho hội thoại này.</small>}
            <div className="chat-composer-actions">
                <small>Enter gửi · Shift+Enter xuống dòng</small>
                {draft.length > 0 && (
                    <small>
                        {preview.remainingBytes < 0
                            ? 'Vượt ' + Math.abs(preview.remainingBytes) + ' byte. Vui lòng rút ngắn.'
                            : 'Còn ' + preview.remainingBytes + ' byte.'}
                        {!preview.valid && preview.remainingBytes >= 0 && text.trim() && ' Vui lòng giảm độ dài hoặc số đoạn.'}
                    </small>
                )}
                <button type="submit" disabled={sendDisabled}>Gửi</button>
            </div>
        </form>
    )
}
