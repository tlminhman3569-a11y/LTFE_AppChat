import { useLayoutEffect, useRef, useState } from 'react'
import type { Message } from '../../types/message'
import { matchesOutgoing } from '../../utils/matchesOutgoing'

export function useHistoryScroll(messages: Message[]) {
    const historyRef = useRef<HTMLDivElement>(null)
    const [hasNewMessages, setHasNewMessages] = useState(false)
    const unseen = useRef(false)
    const saved = useRef({ messages: [] as Message[], anchor: undefined as Message | undefined,
        offset: 0, atBottom: true })

    function rememberPosition() {
        const history = historyRef.current
        if (!history) return
        const top = history.getBoundingClientRect().top
        const bubbles = history.querySelector('.chat-messages')?.children
        const index = bubbles ? Array.from(bubbles).findIndex(bubble => bubble.getBoundingClientRect().bottom > top) : -1
        saved.current = {
            messages,
            anchor: messages[index],
            offset: bubbles && index >= 0 ? bubbles[index].getBoundingClientRect().top - top : 0,
            atBottom: history.scrollHeight - history.clientHeight - history.scrollTop <= 48,
        }
    }

    function scrollToLatest() {
        const history = historyRef.current
        if (!history) return
        history.scrollTop = history.scrollHeight
        unseen.current = false
        setHasNewMessages(false)
        rememberPosition()
    }

    function handleScroll() {
        rememberPosition()
        if (saved.current.atBottom) {
            unseen.current = false
            setHasNewMessages(false)
        }
    }

    useLayoutEffect(() => {
        const history = historyRef.current
        if (!history) return
        const previous = saved.current
        function findPrevious(message: Message | undefined) {
            if (!message) return -1
            const index = messages.indexOf(message)
            return index >= 0 ? index : messages.findIndex(next => message.id != null && next.id != null
                ? String(message.id) === String(next.id) : matchesOutgoing(message, next))
        }

        function restoreAnchor() {
            const history = historyRef.current
            if (!history) return
            const position = saved.current
            const index = findPrevious(position.anchor)
            const bubble = history.querySelector('.chat-messages')?.children[index]
            if (bubble) history.scrollTop += bubble.getBoundingClientRect().top
                - history.getBoundingClientRect().top - position.offset
        }

        const lastIndex = findPrevious(previous.messages.at(-1))
        const appended = lastIndex >= 0 && lastIndex < messages.length - 1
        if (previous.messages.length === 0 || (appended && previous.atBottom)) {
            history.scrollTop = history.scrollHeight
        } else {
            // Neo vào tin đang xem, không cộng cả chiều cao của tin mới ở cuối.
            restoreAnchor()
        }
        if (appended && !previous.atBottom) unseen.current = true
        rememberPosition()
        const timer = setTimeout(() => setHasNewMessages(unseen.current), 0)

        const observer = new ResizeObserver(() => {
            if (saved.current.atBottom) history.scrollTop = history.scrollHeight
            else restoreAnchor()
            rememberPosition()
        })
        observer.observe(history)
        return () => {
            clearTimeout(timer)
            observer.disconnect()
        }
    })

    return { historyRef, hasNewMessages, handleScroll, scrollToLatest }
}
