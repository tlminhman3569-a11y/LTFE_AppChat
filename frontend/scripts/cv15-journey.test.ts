import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login } from '../src/services/authApi'
import { readStoredSession, saveSession } from '../src/services/sessionStorage'
import { socketClient, SocketRequestError } from '../src/services/socketClient'
import { endSession } from '../src/features/auth/endSession'
import { retrySocketConnection, watchSocketConnection } from '../src/features/auth/reconnectSession'
import { clearRoomRequests, getRoomRequest, sendRoomRequest } from '../src/features/rooms/roomRequestState'
import { clearLeaveRequests, getLeaveRequest, updateLeaveRequest } from '../src/features/rooms/leaveRoomRequestState'
import { store } from '../src/store'
import { sessionCleared, sessionStarted } from '../src/store/slices/authSlice'
import { messageReceived } from '../src/store/slices/messagesSlice'
import { refreshRoomMembers, roomConfirmed, roomLeaveRejected } from '../src/store/slices/roomsSlice'
import { createConversationKey } from '../src/utils/conversationKey'
import type { ConnectionStatus } from '../src/types/api'

const fakeSession = { username: 'demo', reLoginCode: 'old-code' }
const room = {
    name: 'nhom_hoc',
    ownerKnown: false,
    membersKnown: false,
    membership: 'member' as const,
}
const chat = { kind: 'room' as const, name: room.name }
const key = createConversationKey(chat)
const listeners = new Set<(status: ConnectionStatus) => void>()
let socketState: ConnectionStatus
let stop: (() => void) | undefined

function mockSessionStorage() {
    const data = new Map<string, string>()
    return {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => data.set(k, v),
        removeItem: (k: string) => data.delete(k),
    }
}

function changeConnection(next: ConnectionStatus) {
    socketState = next
    listeners.forEach(listener => listener(next))
}

async function signIn() {
    const res = await login(fakeSession.username, 'sample-password')
    if (res.status !== 'success') throw new Error('Không chuẩn bị được phiên thử')

    saveSession(res.data)
    store.dispatch(sessionStarted(res.data.username))
    stop = watchSocketConnection()
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('sessionStorage', mockSessionStorage())
    store.dispatch(sessionCleared(undefined))
    socketState = 'disconnected'

    vi.spyOn(socketClient, 'subscribeStatus').mockImplementation(listener => {
        listeners.add(listener)
        listener(socketState)
        return () => { listeners.delete(listener) }
    })
    vi.spyOn(socketClient, 'getStatus').mockImplementation(() => socketState)
    vi.spyOn(socketClient, 'connect').mockImplementation(async () => {
        changeConnection('connected')
    })
    vi.spyOn(socketClient, 'disconnect').mockImplementation(() => {
        changeConnection('disconnected')
    })
    vi.spyOn(socketClient, 'clearSessionListeners').mockImplementation(() => {})
    vi.spyOn(socketClient, 'request').mockImplementation(async event => {
        if (event === 'LOGIN') {
            return { event, status: 'success', data: { RE_LOGIN_CODE: 'old-code' } }
        }
        if (event === 'RE_LOGIN') {
            return { event, status: 'success', data: { RE_LOGIN_CODE: 'new-code' } }
        }
        if (event === 'LOGOUT') return { event, status: 'success' }

        throw new Error(`Chưa có phản hồi mẫu cho ${event}`)
    })
})

afterEach(() => {
    stop?.()
    stop = undefined
    listeners.clear()
    clearRoomRequests()
    clearLeaveRequests()
    store.dispatch(sessionCleared(undefined))
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('Hành trình phiên và kết nối', () => {
    it('kết nối lại vẫn còn tin cũ, đăng xuất thì dọn cả phiên và yêu cầu phòng', async () => {
        await signIn()
        const { sessionGeneration, reconnectCount } = store.getState().auth
        store.dispatch(roomConfirmed(room))
        store.dispatch(messageReceived({
            conversation: chat,
            message: {
                id: 1,
                name: 'ban_cung_nhom',
                to: room.name,
                kind: 'room',
                mes: 'Mai họp nhé',
            },
            viewed: true,
        }))
        await sendRoomRequest(
            'join', room.name, sessionGeneration,
            () => sessionGeneration,
            async () => ({ status: 'success', data: room }),
        )
        updateLeaveRequest(sessionGeneration, room.name, { status: 'error', message: 'Lượt thử trước' })

        changeConnection('disconnected')
        await vi.advanceTimersByTimeAsync(500)

        const state = store.getState()
        const saved = readStoredSession()

        expect(state.auth).toMatchObject({
            connectionStatus: 'connected',
            sessionGeneration,
            reconnectCount: reconnectCount + 1,
        })
        expect(saved).toEqual({ username: 'demo', reLoginCode: 'new-code' })
        expect(state.messages[key]?.messages[0].mes).toBe('Mai họp nhé')
        expect(state.rooms.byKey[key].room.membership).toBe('unknown')
        expect(state.rooms.byKey[key].loadedAt).toBeNull()
        expect(listeners.size).toBe(1)

        await endSession()

        const afterLogout = store.getState()
        const session = readStoredSession()
        const joinRequest = getRoomRequest('join', room.name, sessionGeneration)
        const leaveRequest = getLeaveRequest(sessionGeneration, room.name)

        expect(afterLogout.auth).toMatchObject({
            authStatus: 'unauthenticated',
            connectionStatus: 'disconnected',
            currentUser: null,
        })
        expect(afterLogout.messages).toEqual({})
        expect(afterLogout.rooms.byKey).toEqual({})
        expect(session).toBeNull()
        expect(joinRequest).toBeNull()
        expect(leaveRequest).toBeNull()
        expect(socketClient.request).toHaveBeenLastCalledWith('LOGOUT')
    })

    it('kết nối lại và tải thành viên không xóa lỗi OUT, phải có JOIN mới xác nhận', async () => {
        await signIn()
        const { sessionGeneration } = store.getState().auth
        store.dispatch(roomConfirmed(room))
        store.dispatch(roomLeaveRejected({
            name: room.name,
            sessionGeneration,
            message: 'Máy chủ từ chối rời phòng',
        }))

        changeConnection('disconnected')
        await vi.advanceTimersByTimeAsync(500)

        const afterReconnect = store.getState().rooms.byKey[key]

        expect(afterReconnect.room.membership).toBe('unknown')
        expect(afterReconnect.leaveRejected).toBe('Máy chủ từ chối rời phòng')

        vi.mocked(socketClient.request).mockResolvedValueOnce({
            event: 'GET_ROOM_CHAT_MES',
            status: 'success',
            data: {
                name: room.name,
                own: 'chu_phong',
                userList: [{ name: 'demo' }, { name: 'chu_phong' }],
                chatData: [],
            },
        })

        await store.dispatch(refreshRoomMembers({ name: room.name, sessionGeneration }))

        const afterRefresh = store.getState().rooms.byKey[key]

        // userList có tên mình vẫn chưa đủ để bỏ lần OUT bị từ chối
        expect(socketClient.request).toHaveBeenLastCalledWith('GET_ROOM_CHAT_MES', { name: room.name, page: 1 })
        expect(afterRefresh.error).toBeNull()
        expect(afterRefresh.room.members).toContain('demo')
        expect(afterRefresh.room.membership).toBe('unknown')
        expect(afterRefresh.leaveRejected).toBe('Máy chủ từ chối rời phòng')

        await sendRoomRequest(
            'join', room.name, sessionGeneration,
            () => sessionGeneration,
            async () => ({ status: 'success', data: room }),
            result => {
                if (result.status === 'success') store.dispatch(roomConfirmed(room))
            },
        )

        const afterJoin = store.getState().rooms.byKey[key]

        expect(afterJoin.room.membership).toBe('member')
        expect(afterJoin.leaveRejected).toBeUndefined()
    })

    it('vừa mất mạng đã đăng xuất thì bỏ luôn lượt reconnect đang đợi', async () => {
        await signIn()
        changeConnection('disconnected')
        expect(vi.getTimerCount()).toBe(1)

        await endSession()
        await vi.advanceTimersByTimeAsync(4000)

        const auth = store.getState().auth
        const session = readStoredSession()

        expect(socketClient.request).toHaveBeenCalledTimes(1)
        expect(socketClient.request).toHaveBeenCalledWith('LOGIN', { user: 'demo', pass: 'sample-password' })
        expect(auth).toMatchObject({ authStatus: 'unauthenticated', logoutNotConfirmed: true })
        expect(session).toBeNull()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('hết lượt tự động, bấm thử lại hai lần cũng chỉ thêm một lượt', async () => {
        await signIn()
        const reqSpy = vi.mocked(socketClient.request)
        const err = new SocketRequestError('Hết thời gian chờ phản hồi', 'timeout', true)
        reqSpy
            .mockRejectedValueOnce(err)
            .mockRejectedValueOnce(err)
            .mockRejectedValueOnce(err)

        changeConnection('disconnected')
        await vi.advanceTimersByTimeAsync(3500)

        const disconnected = store.getState().auth.connectionStatus
        const oldSession = readStoredSession()

        expect(disconnected).toBe('disconnected')
        expect(reqSpy).toHaveBeenCalledTimes(4)
        expect(oldSession).toEqual(fakeSession)

        // Bấm liên tiếp lúc đang chờ không được mở thêm lượt RE_LOGIN
        retrySocketConnection()
        retrySocketConnection()
        await vi.advanceTimersByTimeAsync(500)

        const connected = store.getState().auth.connectionStatus
        const session = readStoredSession()

        expect(reqSpy).toHaveBeenCalledTimes(5)
        expect(connected).toBe('connected')
        expect(session).toEqual({ username: 'demo', reLoginCode: 'new-code' })

        await endSession()

        const afterLogout = readStoredSession()

        expect(reqSpy).toHaveBeenLastCalledWith('LOGOUT')
        expect(afterLogout).toBeNull()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('đã dừng theo dõi kết nối thì bỏ qua mã RE_LOGIN trả về sau đó', async () => {
        await signIn()
        type Reply = Awaited<ReturnType<typeof socketClient.request>>
        let sendReply!: (res: Reply) => void
        const reply = new Promise<Reply>(resolve => { sendReply = resolve })
        vi.mocked(socketClient.request).mockReturnValueOnce(reply)
        const { reconnectCount } = store.getState().auth

        changeConnection('disconnected')
        await vi.advanceTimersByTimeAsync(500)
        stop?.()
        stop = undefined

        // Server trả thành công khi effect đã dọn, mã này không còn thuộc lượt đang chạy
        sendReply({ event: 'RE_LOGIN', status: 'success', data: { RE_LOGIN_CODE: 'late-code' } })
        await vi.advanceTimersByTimeAsync(0)

        const session = readStoredSession()
        const auth = store.getState().auth

        expect(session).toEqual(fakeSession)
        expect(auth.reconnectCount).toBe(reconnectCount)
        expect(listeners.size).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
    })
})
