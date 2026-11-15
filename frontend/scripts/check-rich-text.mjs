import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'

const { APPCHAT_PROBE_USER: from, APPCHAT_PROBE_PASS: pass, APPCHAT_PROBE_PEOPLE: to, APPCHAT_PROBE_PEER_PASS: peerPass } = process.env

const url = 'wss://chat.longapp.io.vn/chat/chat'
const sockets = []
const prefix = 'APPCHAT_RICH_V1'

function waitFrame(socket, event, matches = () => true) {
    return new Promise(resolve => {
        const timer = setTimeout(() => finish({ timeout: true }), 3500)
        function finish(result) {
            clearTimeout(timer)
            socket.removeEventListener('message', onMessage)
            socket.removeEventListener('close', onClose)
            resolve(result)
        }
        function onMessage({ data }) {
            try {
                const frame = JSON.parse(data)
                if (frame.event === event && matches(frame)) finish(frame)
            } catch { /* Bỏ qua frame không phải JSON */ }
        }
        function onClose({ code }) { finish({ closeCode: code }) }
        socket.addEventListener('message', onMessage)
        socket.addEventListener('close', onClose)
    })
}

function encodeFrame(event, data) {
    return JSON.stringify({ action: 'onchat', data: { event, data } })
}

async function request(socket, event, data) {
    const pending = waitFrame(socket, event)
    socket.send(encodeFrame(event, data))
    const frame = await pending
    if (frame.status !== 'success') throw new Error(event + ' không thành công')
    return frame.data
}

async function connect() {
    const socket = new WebSocket(url)
    sockets.push(socket)
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Hết thời gian kết nối')), 3500)
        socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
        socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Lỗi mở socket')) }, { once: true })
    })
    return socket
}

async function disconnect(socket) {
    if (socket.readyState === WebSocket.CLOSED) return
    const closed = new Promise(resolve => socket.addEventListener('close', resolve, { once: true }))
    socket.close()
    await Promise.race([closed, sleep(2000)])
}

const cases = []
async function probe(sender, receiver, label, content, mode, size) {
    const marker = randomUUID()
    const json = JSON.stringify({ version: 1, clientMessageId: marker, runs: [
        { text: content, bold: true, italic: false, size: 18 },
        { text: 'Test', bold: false, italic: true, size: 14 },
    ] })
    let mes = mode === 'plain' ? marker + ' ' + content : prefix + json
    if (mode === 'escaped') mes = mes.replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'))
    if (size) mes = mes.replace('"Test"', '"' + 'x'.repeat(size - Buffer.byteLength(mes) + 4) + '"')
    let senderClose
    let senderError = false
    function onSenderMessage({ data }) {
        try {
            if (JSON.parse(data).status === 'error') senderError = true
        } catch { /* Bỏ qua frame không phải JSON */ }
    }
    sender.addEventListener('message', onSenderMessage)
    function onSenderClose(event) { senderClose = event.code }
    sender.addEventListener('close', onSenderClose)
    const pending = waitFrame(receiver, 'SEND_CHAT', frame => frame.data?.name === from
        && frame.data?.to === to && frame.data?.mes?.includes(marker))
    const sendFrame = encodeFrame('SEND_CHAT', { type: 'people', to, mes })
    sender.send(sendFrame)
    const frame = await pending
    await sleep(350)
    sender.removeEventListener('close', onSenderClose)
    sender.removeEventListener('message', onSenderMessage)
    const live = frame.status === 'success' && frame.data?.mes === mes
    cases.push({ label, marker, mes, live, id: frame.data?.id })
    console.log(JSON.stringify({ label, bytes: Buffer.byteLength(mes), frameBytes: Buffer.byteLength(sendFrame), live, hasId: frame.data?.id != null, senderError, senderClose, receiverClose: frame.closeCode }))
    return live
}

async function inspect(receiver, phase) {
    const pages = []
    for (const page of [1, 2]) {
        const data = await request(receiver, 'GET_PEOPLE_CHAT_MES', { name: from, page })
        if (!Array.isArray(data)) throw new Error('Lịch sử không phải mảng')
        pages.push(data)
    }
    console.log(JSON.stringify({ phase, rowsPerPage: pages.map(page => page.length) }))
    let exact = true
    for (const sample of cases) {
        const matches = row => row.name === from && row.to === to && (
            (sample.id != null && row.id != null && String(sample.id) === String(row.id))
            || (typeof row.mes === 'string' && row.mes.includes(sample.marker))
        )
        const page = pages.findIndex(rows => rows.some(matches))
        const row = pages[page]?.find(matches)
        exact &&= row?.mes === sample.mes
        console.log(JSON.stringify({
            phase, label: sample.label, page: page < 0 ? null : page + 1, exact: row?.mes === sample.mes,
            ...(row && row.mes !== sample.mes && typeof row.mes === 'string' ? { rawMesPrefix: row.mes.slice(0, 240) } : {}),
        }))
    }
    return exact
}

async function runCase(label, content, mode, bytes) {
    const sender = await connect()
    const receiver = await connect()
    await request(sender, 'LOGIN', { user: from, pass })
    const session = await request(receiver, 'LOGIN', { user: to, pass: peerPass })
    cases.length = 0
    const live = await probe(sender, receiver, label, content, mode, bytes)
    await disconnect(receiver)
    const restored = await connect()
    let restoredBy = 'RE_LOGIN'
    try {
        if (typeof session?.RE_LOGIN_CODE !== 'string') throw new Error('Thiếu mã RE_LOGIN')
        await request(restored, 'RE_LOGIN', { user: to, code: session.RE_LOGIN_CODE })
    } catch {
        restoredBy = 'LOGIN'
        await request(restored, 'LOGIN', { user: to, pass: peerPass })
    }
    console.log(JSON.stringify({ label, restoredBy }))
    await inspect(restored, 'after-reopen')
    await sleep(3000)
    const exact = await inspect(restored, 'after-3s')
    await Promise.all([disconnect(restored), disconnect(sender)])
    await sleep(process.argv[2] === '--boundary' ? 2000 : 300)
    return live && exact
}

try {
    if (!from || !pass || !to || !peerPass || from.toLowerCase() === to.toLowerCase()) {
        throw new Error('Cần hai tài khoản thử khác nhau. Kiểm tra APPCHAT_PROBE_USER, APPCHAT_PROBE_PASS, APPCHAT_PROBE_PEOPLE và APPCHAT_PROBE_PEER_PASS.')
    }
    if (typeof WebSocket !== 'function') throw new Error('Cần Node.js có WebSocket tích hợp.')
    console.log(JSON.stringify({ startedAt: new Date().toISOString(), node: process.version }))
    const mode = process.argv[2]
    const sizeMode = mode === '--sizes' || mode === '--boundary'
    if (sizeMode) {
        const sizes = mode === '--boundary' ? [2000, 2001, 2000, 2001] : [1291, 1536, 1792, 1920, 2000, 2048]
        for (const bytes of sizes) {
            if (!await runCase('escaped-' + bytes, 'Tiếng Việt 😊\nDòng hai 🚀', 'escaped', bytes)) process.exitCode = 1
        }
    }
    for (let round = 1; !sizeMode && round <= 3; round++) {
        for (const [label, content, mode] of [
            ['ascii', 'Hello', 'raw'],
            ['vi', 'Tiếng Việt có dấu', 'raw'],
            ['newline', 'Line 1\nLine 2', 'raw'],
            ['plain-vi', 'Tiếng Việt có dấu', 'plain'],
            ['emoji', '😊🚀', 'raw'],
            ['mixed', 'Tiếng Việt 😊\nDòng hai 🚀', 'raw'],
        ]) {
            if (!await runCase(label + '-' + round, content, mode)) process.exitCode = 1
        }
    }
} catch (error) {
    console.error(error.message)
    process.exitCode = 1
} finally {
    await Promise.all(sockets.map(disconnect))
}
