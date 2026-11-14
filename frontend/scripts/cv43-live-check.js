(async () => {
    const existingName = window.prompt('Nhập username thử đã tồn tại:')?.trim()
    const missingName = window.prompt('Nhập username thử chắc chắn không tồn tại:')?.trim()

    if (!existingName || !missingName || existingName === missingName) {
        console.log('Hủy kiểm tra: cần hai username thử khác nhau.')
        return
    }

    const { socketClient } = await import('/src/services/socketClient.ts')
    const { parseUserExists } = await import('/src/utils/parseUserChecks.ts')
    const { loadHistory } = await import('/src/services/chatApi.ts')
    const { store } = await import('/src/store/index.ts')
    const connection = socketClient.getStatus()
    const results = []

    async function check(name, expected, label) {
        try {
            const response = await socketClient.request('CHAT_CHECK_USER_EXIST', { user: name })
            const parsed = parseUserExists(response)
            const actual = parsed.status === 'success' ? parsed.data : 'khong_xac_dinh'
            const dataStatus = response.data && typeof response.data === 'object'
                ? response.data.status : undefined

            results.push({
                case: label,
                event: response.event === 'CHECK_USER_EXIST' ? 'CHECK_USER_EXIST' : 'KHONG_KHOP',
                outerStatus: response.status === 'success' ? 'success' : response.status === undefined ? 'khong_co' : 'khong_success',
                sample: { data: { status: typeof dataStatus === 'boolean' ? dataStatus : 'khong_phai_boolean' } },
                parser: parsed.status,
                value: actual,
                pass: parsed.status === 'success' && actual === expected,
            })
        } catch {
            results.push({ case: label, event: 'khong_nhan_duoc', parser: 'error', pass: false })
        }
    }

    if (location.pathname === '/chat' && connection === 'connected') {
        await check(existingName, true, 'username_ton_tai')
        await check(missingName, false, 'username_khong_ton_tai')
    }

    let history = { status: 'chua_kiem_tra', messageCount: null }
    const first = results.find(item => item.case === 'username_ton_tai')
    if (first?.pass) {
        try {
            const currentUser = store.getState().auth.currentUser
            const result = await loadHistory({ kind: 'people', name: existingName }, 1, currentUser)
            history = result.status === 'success'
                ? { status: 'success', messageCount: result.data.messages.length }
                : { status: result.status, errorKind: result.error.kind, messageCount: null }
        } catch {
            history = { status: 'error', errorKind: 'connection', messageCount: null }
        }
    }

    const passed = location.pathname === '/chat'
        && connection === 'connected'
        && results.length === 2
        && results.every(item => item.pass)
        && history.status === 'success'

    const report = [
        'CV43 - LIVE CHECK (DA CHE THONG TIN)',
        `UTC: ${new Date().toISOString()}`,
        `Trang: ${location.pathname === '/chat' ? '/chat' : 'khong_phai_chat'}`,
        `WebSocket: ${connection}`,
        ...results.map(item => `${item.case}: ${JSON.stringify(item)}`),
        `GET_PEOPLE_CHAT_MES page=1: ${JSON.stringify(history)}`,
        `KET QUA: ${passed ? 'PASS' : 'CHUA DAT'}`,
        'Khong ghi username, mat khau, token, noi dung tin nhan hoac ma phien.',
    ].join('\n')

    console.log(report)
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'CV43_API_LIVE_DA_CHE.txt'
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
})()
