import assert from 'node:assert/strict'

// Phép đối chiếu độc lập adapter; không in password hoặc RE_LOGIN_CODE.
const { APPCHAT_PROBE_USER: user, APPCHAT_PROBE_PASS: pass } = process.env
const roomName = 'cv32_identity_' + Date.now()
const startedAt = new Date().toISOString()
const freshSession = process.argv.includes('--fresh-session')
let socket
async function connect() {
    socket = new WebSocket('wss://chat.longapp.io.vn/chat/chat')
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout mở socket')), 10000)
        socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
        socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Không mở được socket')) }, { once: true })
    })
}
function request(event, data) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('Timeout ' + event)), 10000)
        function finish(error, frame) {
            clearTimeout(timer)
            socket.removeEventListener('message', onMessage)
            socket.removeEventListener('close', onClose)
            if (error) reject(error)
            else resolve(frame)
        }
        function onClose() { finish(new Error('Socket đóng khi chờ ' + event)) }
        function onMessage({ data }) {
            try {
                const frame = JSON.parse(data)
                if (frame.event === event) finish(null, frame)
            } catch { /* Bỏ qua frame không phải JSON. */ }
        }
        socket.addEventListener('message', onMessage)
        socket.addEventListener('close', onClose)
        socket.send(JSON.stringify({ action: 'onchat', data: { event, data } }))
    })
}

try {
    assert.ok(user && pass, 'Cần APPCHAT_PROBE_USER và APPCHAT_PROBE_PASS')
    await connect()
    let login = await request('LOGIN', { user, pass })
    assert.equal(login.status, 'success', 'LOGIN không thành công')
    if (freshSession) {
        const logout = await request('LOGOUT')
        assert.equal(logout.status, 'success', 'Chưa xác nhận được LOGOUT')
        const oldSocket = socket
        if (oldSocket.readyState !== WebSocket.CLOSED) {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Timeout đóng phiên cũ')), 3000)
                oldSocket.addEventListener('close', () => { clearTimeout(timer); resolve() }, { once: true })
                oldSocket.close()
            })
        }
        await connect()
        login = await request('LOGIN', { user, pass })
        assert.equal(login.status, 'success', 'LOGIN phiên mới không thành công')
    }
    const created = await request('CREATE_ROOM', { name: roomName })
    assert.equal(created.status, 'success', 'CREATE_ROOM không thành công')
    assert.equal(created.data?.name, roomName, 'Tên phòng phản hồi không khớp')
    const read = await request('GET_ROOM_CHAT_MES', { name: roomName, page: 1 })
    assert.equal(read.status, 'success', 'GET_ROOM_CHAT_MES không thành công')
    assert.equal(read.data?.name, roomName, 'Tên phòng đọc lại không khớp')
    assert.equal(typeof created.data?.own, 'string', 'Phản hồi tạo thiếu chủ phòng')
    assert.equal(typeof read.data?.own, 'string', 'Phản hồi đọc thiếu chủ phòng')
    const ownerMatches = created.data?.own === user && read.data?.own === user
    console.log(JSON.stringify({ startedAt, node: process.version,
        roomName, freshSession, loginSuccess: true, createSuccess: true, readSuccess: read.status === 'success',
        ownerPresent: typeof created.data?.own === 'string', ownerMatchesCreator: ownerMatches }))
    assert.ok(ownerMatches, 'API trả chủ phòng khác tài khoản vừa LOGIN; dừng và đối chiếu phía máy chủ.')
} catch (error) {
    console.error(error.message)
    process.exitCode = 1
} finally { socket?.close() }
