import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { env } from 'node:process'
import { randomUUID } from 'node:crypto'
import type { ConversationRef } from '../src/types/api'
import type { LoginSession } from '../src/services/sessionStorage'
import type { Message, RichMessageContent, TextSize } from '../src/types/message'
import { parseRichMessage, serializeRichMessage } from '../src/utils/richMessage'
import { createConversationKey } from '../src/utils/conversationKey'

const users = [env.APPCHAT_PROBE_USER, env.APPCHAT_PROBE_PEOPLE]
const passwords = [env.APPCHAT_PROBE_PASS, env.APPCHAT_PROBE_PEER_PASS]
const enabled = Boolean(users[0] && users[1] && passwords[0] && passwords[1])
const marker = 'CV32_' + Date.now()
const room: ConversationRef = { kind: 'room', name: marker.toLowerCase() }

async function createClient() {
    vi.resetModules()
    const auth = await import('../src/services/authApi')
    const chat = await import('../src/services/chatApi')
    const rooms = await import('../src/services/roomsApi')
    const { socketClient } = await import('../src/services/socketClient')
    const { store } = await import('../src/store')
    const actions = await import('../src/store/slices/messagesSlice')
    const sessionActions = await import('../src/store/slices/authSlice')
    return { auth, chat, rooms, socketClient, store, actions, sessionActions, session: null as LoginSession | null }
}
type Client = Awaited<ReturnType<typeof createClient>>
const clients: Client[] = []
const samples: { conversation: ConversationRef; mes: string; content: RichMessageContent; sender: string }[] = []
let roomReady = false
async function waitFor(predicate: () => boolean) {
    const end = Date.now() + 8000
    while (!predicate() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 50))
    expect(predicate(), 'Chưa nhận được dữ liệu thử trong thời gian chờ').toBe(true)
}
async function restore(client: Client) {
    client.socketClient.disconnect()
    const restored = await client.auth.reLogin(client.session!)
    expect(restored.status, 'RE_LOGIN API thật').toBe('success')
    if (restored.status === 'success') client.session = restored.data
}
async function verifyHistory(client: Client, conversation: ConversationRef, mes: string, content: RichMessageContent, sender: string) {
    const result = await client.chat.loadHistory(conversation, 1, client.session!.username)
    if (result.status !== 'success') console.log(JSON.stringify({ phase: 'history-error', kind: conversation.kind, error: result.error.kind }))
    expect(result.status, 'Đọc lại lịch sử API thật').toBe('success')
    if (result.status !== 'success') return
    const matches = result.data.messages.filter(message => message.mes === mes)
    expect(matches.length, 'Một bản lưu khớp toàn bộ mes thử').toBe(1)
    expect(matches[0].name, 'Tác giả bản lưu khớp người gửi').toBe(sender)
    expect(matches[0].kind).toBe(conversation.kind)
    expect(matches[0].to).toBe(conversation.kind === 'room' ? conversation.name : client.session!.username)
    expect(parseRichMessage(matches[0].mes)).toEqual(content)
    expect(matches[0].id != null, 'Bản lưu có ID máy chủ').toBe(true)
}

describe.skipIf(!enabled)('CV32 — hai phiên API thật', () => {
    beforeAll(async () => {
        expect(users[0]!.toLowerCase() !== users[1]!.toLowerCase()).toBe(true)
        vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
        for (let index = 0; index < 2; index++) {
            const client = await createClient()
            clients.push(client)
            if (env.APPCHAT_CV32_FRESH_SESSION === '1') {
                const initial = await client.auth.login(users[index]!, passwords[index]!)
                expect(initial.status, 'LOGIN chuẩn bị phiên thử').toBe('success')
                expect((await client.auth.logout()).status, 'LOGOUT chuẩn bị phiên thử').toBe('success')
            }
        }
        // Dọn xong cả hai phiên rồi mới đăng nhập hai client dùng để thử.
        for (let index = 0; index < 2; index++) {
            const client = clients[index]
            const login = await client.auth.login(users[index]!, passwords[index]!)
            expect(login.status, 'Đăng nhập tài khoản thử ' + index).toBe('success')
            if (login.status !== 'success') throw new Error('Đăng nhập không thành công')
            client.session = login.data
            client.store.dispatch(client.sessionActions.sessionStarted(login.data.username))
            client.store.dispatch(client.sessionActions.connectionStatusChanged('connected'))
        }
        expect(clients[0].socketClient === clients[1].socketClient, 'Hai module socket độc lập').toBe(false)
        console.log(JSON.stringify({ marker, room: room.name, startedAt: new Date().toISOString(),
            node: process.version, freshSession: env.APPCHAT_CV32_FRESH_SESSION === '1' }))
    }, 30000)
    afterAll(() => {
        for (const client of clients) client.socketClient.disconnect()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('tạo phòng thử riêng và xác nhận tài khoản thứ hai tham gia', async () => {
        const created = await clients[0].rooms.createRoom(room.name)
        expect(created.status).toBe('success')
        if (created.status !== 'success') return
        console.log(JSON.stringify({ phase: 'room-identity', room: room.name,
            ownerKnown: created.data.ownerKnown, ownerMatchesCreator: created.data.owner === users[0] }))
        // Không tiếp tục ghi dữ liệu nếu API gắn thao tác vào tài khoản khác.
        expect(created.data.owner === users[0], 'API phải xác nhận đúng chủ phòng vừa tạo trước khi thử tiếp').toBe(true)
        expect((await clients[1].rooms.joinRoom(room.name)).status).toBe('success')
        for (const client of clients) {
            const read = await client.rooms.loadRoom(room.name, 1)
            expect(read.status).toBe('success')
            if (read.status === 'success') {
                expect(read.data.owner === users[0] || read.data.members?.includes(users[0]!)).toBe(true)
                expect(read.data.members?.includes(users[1]!)).toBe(true)
            }
        }
        roomReady = true
    }, 30000)

    for (const kind of ['people', 'room'] as const) {
        for (const size of [12, 14, 16, 18, 24] as TextSize[]) {
            it(`${kind}: text/emoji/xuống dòng/bold/italic/size ${size} nhận và lưu nguyên vẹn`, async context => {
                if (!roomReady) context.skip('Chưa xác minh đúng danh tính hai tài khoản trên API')
                const index = kind === 'people' ? 0 : 1
                const from = clients[index]
                const to = clients[1 - index]
                const conversation: ConversationRef = kind === 'people' ? { kind, name: to.session!.username } : room
                const content: RichMessageContent = { version: 1, clientMessageId: randomUUID(), runs: [
                    { text: marker + ' Tiếng Việt 😊\n', bold: true, italic: false, size },
                    { text: 'Nghiêng và đậm ✅𝒜', bold: true, italic: true, size },
                    { text: ' Văn bản thường', bold: false, italic: false, size },
                ] }
                const encoded = serializeRichMessage(content)
                expect(encoded.status).toBe('success')
                if (encoded.status !== 'success') return
                expect(/[^\x20-\x7e]/.test(encoded.data)).toBe(false)
                let incoming: Message | undefined
                const unsubscribe = to.chat.subscribeToMessages(to.session!.username, (_, message) => {
                    if (message.clientMessageId === content.clientMessageId) incoming = message
                }, () => {})
                try {
                    from.chat.sendText(conversation, encoded.data)
                    await waitFor(() => Boolean(incoming))
                    expect(incoming!.kind).toBe(kind)
                    expect(incoming!.name).toBe(from.session!.username)
                    expect(incoming!.to).toBe(conversation.name)
                    expect(incoming!.mes).toBe(encoded.data)
                    const receivingConversation = kind === 'people' ? { kind, name: from.session!.username } : room
                    await verifyHistory(to, receivingConversation, encoded.data, content, from.session!.username)
                    samples.push({ conversation: receivingConversation, mes: encoded.data, content, sender: from.session!.username })
                } finally { unsubscribe() }
            }, 20000)
        }
    }

    it('mở socket mới RE_LOGIN rồi đọc lại đủ định dạng riêng/phòng', async context => {
        if (!roomReady) context.skip('Chưa xác minh đúng danh tính hai tài khoản trên API')
        expect(samples.length).toBe(10)
        await restore(clients[0])
        await restore(clients[1])
        for (const sample of samples) {
            const client = sample.conversation.kind === 'people' ? clients[1] : clients[0]
            await verifyHistory(client, sample.conversation, sample.mes, sample.content, sample.sender)
        }
    }, 30000)

    it('đọc hai trang và đổi đích liên tiếp không ghi nhầm khóa Redux', async context => {
        if (!roomReady) context.skip('Chưa xác minh đúng danh tính hai tài khoản trên API')
        const client = clients[0]
        const privateChat: ConversationRef = { kind: 'people', name: users[1]! }
        const sessionGeneration = client.store.getState().auth.sessionGeneration
        await Promise.all([privateChat, room].map(conversation => client.store.dispatch(
            client.actions.fetchHistoryPage({ conversation, page: 1, sessionGeneration }),
        )))
        for (const conversation of [privateChat, room]) {
            const result = await client.chat.loadHistory(conversation, 2, client.session!.username)
            console.log(JSON.stringify({ phase: 'page-two', kind: conversation.kind, status: result.status,
                error: result.status === 'success' ? null : result.error.kind,
                socket: client.socketClient.getStatus() }))
            expect(result.status).toBe('success')
            const history = client.store.getState().messages[createConversationKey(conversation)]!
            expect(history.error).toBe('')
            expect(history.messages.every(message => message.kind === conversation.kind)).toBe(true)
            if (conversation.kind === 'room') expect(history.messages.every(message => message.to === room.name)).toBe(true)
        }
    }, 30000)

    it('ngắt kết nối ngay sau gửi: chưa xác nhận, RE_LOGIN đối chiếu, không gửi lại', async context => {
        if (!roomReady) context.skip('Chưa xác minh đúng danh tính hai tài khoản trên API')
        const from = clients[0]
        // Mỗi ca tự mở phiên hợp lệ; lỗi đọc ở ca trước không thay cho phép ngắt sau gửi.
        await restore(from)
        from.store.dispatch(from.sessionActions.sessionReconnected())
        const conversation: ConversationRef = { kind: 'people', name: users[1]! }
        const content: RichMessageContent = { version: 1, clientMessageId: randomUUID(), runs: [
            { text: marker + ' Ngắt kết nối sau gửi 😊', bold: false, italic: true, size: 18 },
        ] }
        const encoded = serializeRichMessage(content)
        if (encoded.status !== 'success') throw new Error('Mẫu thử không hợp lệ')
        from.store.dispatch(from.actions.outgoingQueued({ conversation, message: {
            kind: 'people', name: users[0]!, to: users[1]!, mes: encoded.data, localId: content.clientMessageId,
            clientMessageId: content.clientMessageId, status: 'pending', sentAt: Date.now(),
        } }))
        const sends = vi.spyOn(from.socketClient, 'send')
        from.chat.sendText(conversation, encoded.data)
        from.socketClient.disconnect()
        from.store.dispatch(from.sessionActions.connectionStatusChanged('disconnected'))
        from.store.dispatch(from.actions.outgoingExpired(Date.now()))
        const key = createConversationKey(conversation)
        expect(from.store.getState().messages[key]!.outgoing![0].status).toBe('unconfirmed')
        await restore(from)
        from.store.dispatch(from.sessionActions.sessionReconnected())
        try {
            await from.store.dispatch(from.actions.reconcileOutgoing({ conversation,
                sessionGeneration: from.store.getState().auth.sessionGeneration }))
            const history = from.store.getState().messages[key]!
            expect(history.reconcileError ?? '').toBe('')
            const saved = history.messages.filter(message => message.mes === encoded.data)
            expect(saved.length <= 1, 'Không tạo bản lưu trùng trong store').toBe(true)
            if (saved.length === 1) {
                expect(history.outgoing!.length).toBe(0)
                expect(saved[0].deliveryStatus).toBe('saved')
            } else {
                // Ngắt sau send không chứng minh máy chủ đã lưu hoặc đã từ chối.
                expect(history.outgoing!.length).toBe(1)
                expect(history.outgoing![0].status).toBe('unconfirmed')
            }
            expect(sends).toHaveBeenCalledTimes(1)
        } finally { sends.mockRestore() }
    }, 30000)
})
