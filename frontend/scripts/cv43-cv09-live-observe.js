(async () => {
    if (window.__cv43Cv09Observe?.stop) window.__cv43Cv09Observe.stop()

    const mode = window.prompt('Chọn ca kiểm thử: auto hoặc manual', 'auto')?.trim().toLowerCase()
    if (mode !== 'auto' && mode !== 'manual') return

    const { store } = await import('/src/store/index.ts')
    const { socketClient } = await import('/src/services/socketClient.ts')
    const auth = store.getState().auth
    const selected = document.querySelector('.chat-heading h2')?.textContent?.trim()
    const draft = document.querySelector('#chat-draft')?.value

    if (location.pathname !== '/chat' || auth.authStatus !== 'authenticated' ||
        !auth.currentUser || !selected || !draft?.trim()) {
        console.log('Mở /chat, chọn chat riêng và nhập bản nháp chưa gửi trước khi chạy.')
        return
    }

    const initialUser = auth.currentUser
    const initialGeneration = auth.sessionGeneration
    const initialReconnectCount = auth.reconnectCount
    const initialConversation = selected
    const previousRequest = socketClient.request
    let inFlight = 0
    let peakReLogin = 0
    let reLoginCalls = 0
    let reLoginSuccess = 0
    let reLoginError = 0
    let historyBeforeReauth = 0
    let historyAfterReauth = 0
    let historySuccess = 0
    let manualClicks = 0
    let manualClickAfterExhausted = 0
    let countIncrementEvents = 0
    let stopped = false
    let latestCount = initialReconnectCount

    const unsubscribe = store.subscribe(() => {
        const count = store.getState().auth.reconnectCount
        if (count !== latestCount) {
            if (count > latestCount) countIncrementEvents += count - latestCount
            latestCount = count
        }
    })

    const onClick = event => {
        const button = event.target?.closest?.('button')
        if (button?.textContent?.includes('Thử kết nối lại')) {
            manualClicks++
            if (store.getState().auth.connectionStatus === 'disconnected') manualClickAfterExhausted++
        }
    }
    document.addEventListener('click', onClick, true)

    socketClient.request = async function (event, data) {
        if (event === 'RE_LOGIN') {
            reLoginCalls++
            inFlight++
            peakReLogin = Math.max(peakReLogin, inFlight)
            try {
                const response = await previousRequest.call(socketClient, event, data)
                if (response?.status === 'success' && typeof response.data?.RE_LOGIN_CODE === 'string') {
                    reLoginSuccess++
                } else {
                    reLoginError++
                }
                return response
            } catch (error) {
                reLoginError++
                throw error
            } finally {
                inFlight--
            }
        }
        if (event === 'GET_PEOPLE_CHAT_MES' && data?.name === initialConversation && data?.page === 1) {
            const reauthed = store.getState().auth.reconnectCount > initialReconnectCount
            if (reauthed) historyAfterReauth++
            else historyBeforeReauth++
            const reply = await previousRequest.call(socketClient, event, data)
            if (reauthed && reply?.status === 'success' && Array.isArray(reply.data)) historySuccess++
            return reply
        }
        return previousRequest.call(socketClient, event, data)
    }

    const panel = document.createElement('div')
    Object.assign(panel.style, {
        position: 'fixed', right: '14px', bottom: '14px', zIndex: 100000,
        padding: '12px', border: '1px solid #1d4ed8', borderRadius: '8px',
        color: '#111827', background: '#fff', font: '13px Arial, sans-serif'
    })
    const description = document.createElement('div')
    description.textContent = mode === 'auto'
        ? 'AUTO: Tạm ngắt mạng rồi khôi phục trong lúc CV09 còn tự thử. Không bấm Thử kết nối lại.'
        : 'MANUAL: Để CV09 tự thử hết 3 lượt, khôi phục mạng và bấm Thử kết nối lại.'
    panel.append(description)

    function stop() {
        if (stopped) return
        stopped = true
        socketClient.request = previousRequest
        unsubscribe()
        document.removeEventListener('click', onClick, true)
        panel.remove()
        delete window.__cv43Cv09Observe
    }

    const exportButton = document.createElement('button')
    exportButton.textContent = 'Xuất log đã che'
    exportButton.type = 'button'
    exportButton.style.margin = '8px'
    exportButton.onclick = () => {
        const now = store.getState().auth
        const sameUser = now.currentUser === initialUser && now.authStatus === 'authenticated'
        const sameSession = now.sessionGeneration === initialGeneration
        const sameConversation = document.querySelector('.chat-heading h2')?.textContent?.trim() === initialConversation
        const sameDraft = document.querySelector('#chat-draft')?.value === draft
        const historyElement = document.querySelector('.chat-history')
        const historyReady = !!historyElement && historyElement.getAttribute('aria-busy') !== 'true' &&
            !historyElement.querySelector('[role="alert"]')
        const correctAction = mode === 'auto' ? manualClicks === 0 : manualClickAfterExhausted > 0
        const passed = reLoginSuccess > 0 && peakReLogin <= 1 && countIncrementEvents === 1 &&
            now.reconnectCount === initialReconnectCount + 1 && historyBeforeReauth === 0 &&
            historyAfterReauth > 0 && historySuccess > 0 && sameUser && sameSession &&
            sameConversation && sameDraft && historyReady && correctAction
        const log = [
            'CV43-CV09 LIVE API (REDACTED)',
            `Mode: ${mode}`,
            `UTC: ${new Date().toISOString()}`,
            `RE_LOGIN requests sent: ${reLoginCalls}`,
            `RE_LOGIN successful response observed: ${reLoginSuccess}`,
            `RE_LOGIN failed response observed: ${reLoginError}`,
            `Max simultaneous RE_LOGIN: ${peakReLogin}`,
            `Redux reconnectCount increments: ${countIncrementEvents}`,
            `History page=1 before Redux reconnection success: ${historyBeforeReauth}`,
            `History page=1 after Redux reconnection success: ${historyAfterReauth}`,
            `History API success after reconnection: ${historySuccess}`,
            `Manual button clicks: ${manualClicks}`,
            `Manual clicked after disconnected: ${manualClickAfterExhausted}`,
            `Same authenticated user: ${sameUser}`,
            `Same sessionGeneration: ${sameSession}`,
            `Same selected conversation: ${sameConversation}`,
            `Draft preserved: ${sameDraft}`,
            `History UI loaded: ${historyReady}`,
            `Result: ${passed ? 'PASS' : 'NOT_CONFIRMED'}`,
            'The three failed auto attempts require separate confirmation because an unopened socket cannot emit RE_LOGIN.',
            'No username, password, draft text, message content or RE_LOGIN code recorded.'
        ].join('\n')
        console.log(log)
        const url = URL.createObjectURL(new Blob([log], { type: 'text/plain;charset=utf-8' }))
        const a = document.createElement('a')
        a.href = url
        a.download = `CV43_CV09_${mode.toUpperCase()}_DA_CHE.txt`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        stop()
    }
    panel.append(exportButton)

    const stopButton = document.createElement('button')
    stopButton.type = 'button'
    stopButton.textContent = 'Dừng'
    stopButton.onclick = stop
    panel.append(stopButton)

    document.body.append(panel)
    window.__cv43Cv09Observe = { stop }
    console.log(`CV43/CV09 is monitoring ${mode}. No extra WebSocket or RE_LOGIN was created.`)
})()
