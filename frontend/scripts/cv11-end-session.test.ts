import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { endSession } from '../src/features/auth/endSession'
import { clearLeaveRequests, getLeaveRequest, updateLeaveRequest } from '../src/features/rooms/leaveRoomRequestState'
import { clearRoomRequests, getRoomRequest, sendRoomRequest } from '../src/features/rooms/roomRequestState'
import { readStoredSession, saveSession } from '../src/services/sessionStorage'
import { socketClient } from '../src/services/socketClient'
import { store } from '../src/store'
import { connectionStatusChanged, sessionCleared, sessionStarted } from '../src/store/slices/authSlice'
import { refreshConversations } from '../src/store/slices/conversationsSlice'
import { messageReceived } from '../src/store/slices/messagesSlice'

const fakeSession = { username: 'demo', reLoginCode: 'old-code' }
const room = { name: 'nhom_hoc', ownerKnown: false, membersKnown: false, membership: 'member' } as const

beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
    })
    store.dispatch(sessionCleared({}))
    store.dispatch(sessionStarted(fakeSession.username))
    saveSession(fakeSession)

    vi.spyOn(socketClient, 'disconnect').mockImplementation(() => {})
    vi.spyOn(socketClient, 'clearSessionListeners').mockImplementation(() => {})
})

afterEach(() => {
    clearRoomRequests()
    clearLeaveRequests()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('Kết thúc phiên đăng nhập', () => {
    it('mất mạng vẫn xóa phiên, hội thoại, tin nhắn và yêu cầu phòng', async () => {
        const { sessionGeneration } = store.getState().auth
        const conversation = { kind: 'room', name: room.name } as const
        const reqSpy = vi.spyOn(socketClient, 'request')
        vi.spyOn(socketClient, 'getStatus').mockReturnValue('disconnected')
        store.dispatch(refreshConversations.pending('list', sessionGeneration))
        store.dispatch(refreshConversations.fulfilled({
            status: 'success', data: [conversation],
        }, 'list', sessionGeneration))
        store.dispatch(messageReceived({
            conversation, viewed: false,
            message: { ...conversation, name: 'ban', to: room.name, mes: 'Chào', id: 1 },
        }))
        await sendRoomRequest('join', room.name, sessionGeneration, () => sessionGeneration,
            async () => ({ status: 'success', data: room }))
        updateLeaveRequest(sessionGeneration, room.name, { status: 'unknown', message: 'Chưa rõ đã rời phòng' })

        await endSession()
        const state = store.getState()

        expect(reqSpy).not.toHaveBeenCalled()
        expect(readStoredSession()).toBeNull()
        expect(state.auth).toMatchObject({ authStatus: 'unauthenticated', logoutNotConfirmed: true })
        expect(state.auth.sessionGeneration).toBe(sessionGeneration + 1)
        expect(state.conversations.items).toEqual([])
        expect(state.messages).toEqual({})
        expect(getRoomRequest('join', room.name, sessionGeneration)).toBeNull()
        expect(getLeaveRequest(sessionGeneration, room.name)).toBeNull()
        expect(socketClient.clearSessionListeners).toHaveBeenCalledOnce()
    })

    it('chỉ gửi LOGOUT một lần khi bấm xác nhận liên tiếp', async () => {
        store.dispatch(connectionStatusChanged('connected'))
        vi.spyOn(socketClient, 'getStatus').mockReturnValue('connected')
        const reqSpy = vi.spyOn(socketClient, 'request').mockResolvedValue({ event: 'LOGOUT', status: 'success' })
        const { sessionGeneration } = store.getState().auth

        await Promise.all([endSession(), endSession()])
        const auth = store.getState().auth

        expect(reqSpy).toHaveBeenCalledExactlyOnceWith('LOGOUT')
        expect(auth).toMatchObject({ authStatus: 'unauthenticated', logoutNotConfirmed: false })
        expect(auth.sessionGeneration).toBe(sessionGeneration + 1)
    })
})
