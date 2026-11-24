import { useLayoutEffect, useRef } from 'react'

export function useChatViewport(conversationKey: string | null) {
    const pageRef = useRef<HTMLElement>(null)

    useLayoutEffect(() => {
        const page = pageRef.current
        if (!page) return
        const viewport = window.visualViewport
        let timer: ReturnType<typeof setTimeout>

        function updateHeight() {
            if (!page) return
            const height = viewport?.height ?? window.innerHeight
            const bottom = height + (viewport?.offsetTop ?? 0)
            const available = Math.max(0, Math.min(height, bottom - page.getBoundingClientRect().top))
            page.style.setProperty('--chat-height', available + 'px')
        }
        function scheduleUpdate() {
            clearTimeout(timer)
            timer = setTimeout(updateHeight, 0)
        }
        updateHeight()
        window.addEventListener('resize', scheduleUpdate)
        window.addEventListener('scroll', scheduleUpdate)
        viewport?.addEventListener('resize', scheduleUpdate)
        viewport?.addEventListener('scroll', scheduleUpdate)
        // Thanh phiên có thể xuống dòng khi màn hẹp hoặc hiện lỗi kết nối.
        const observer = new ResizeObserver(scheduleUpdate)
        const header = page.closest('.chat-layout')?.querySelector('.session-bar')
        if (header) observer.observe(header)
        return () => {
            clearTimeout(timer)
            observer.disconnect()
            window.removeEventListener('resize', scheduleUpdate)
            window.removeEventListener('scroll', scheduleUpdate)
            viewport?.removeEventListener('resize', scheduleUpdate)
            viewport?.removeEventListener('scroll', scheduleUpdate)
        }
    }, [conversationKey])

    return pageRef
}
