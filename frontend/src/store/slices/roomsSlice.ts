import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { loadRoom } from '../../services/roomsApi'
import type { ApiError, ApiResult, AuthStatus, ConnectionStatus } from '../../types/api'
import type { Room, RoomReadResult } from '../../types/room'
import { createConversationKey } from '../../utils/conversationKey'
import { sessionChecking, sessionCleared, sessionStarted } from './authSlice'
import { fetchHistoryPage } from './messagesSlice'

interface RoomEntry {
    room: Room
    loading: boolean
    loadedAt: string | null
    error: ApiError | null
    requestId?: string
    leaveUncertain?: boolean
}

interface RoomsState {
    sessionGeneration: number
    currentUser: string | null
    byKey: Record<string, RoomEntry>
}

type RoomStore = {
    auth: { authStatus: AuthStatus; connectionStatus: ConnectionStatus; sessionGeneration: number }
    rooms: RoomsState
}

const initialState = (): RoomsState => ({ sessionGeneration: 0, currentUser: null, byKey: {} })
const resetState = (state: RoomsState): RoomsState => ({ ...initialState(), sessionGeneration: state.sessionGeneration + 1 })
const roomKey = (name: string) => createConversationKey({ kind: 'room', name })
const emptyRoom = (name: string): Room => ({ name, ownerKnown: false, membersKnown: false, membership: 'unknown' })

function roomEntry(state: RoomsState, name: string): RoomEntry {
    const key = roomKey(name)
    return state.byKey[key] ??= { room: emptyRoom(name), loading: false, loadedAt: null, error: null }
}

function mergeMetadata(state: RoomsState, data: RoomReadResult): void {
    const entry = roomEntry(state, data.roomName)
    const previous = entry.room
    const room: Room = { ...previous }
    if (data.ownerKnown && data.owner !== undefined) {
        room.owner = data.owner
        room.ownerKnown = true
    }
    if (data.membersKnown && data.members !== undefined) {
        room.members = [...data.members]
        room.membersKnown = true
    }

    if (!entry.leaveUncertain && previous.membership !== 'left' && state.currentUser) {
        if (room.ownerKnown && room.owner === state.currentUser) room.membership = 'owner'
        else if (room.membersKnown && room.members?.includes(state.currentUser)) room.membership = 'member'
        else if (data.membersKnown || (data.ownerKnown && previous.membership === 'owner')) room.membership = 'unknown'
    }
    entry.room = room
    if (data.membersKnown) {
        entry.loadedAt = new Date().toISOString()
        entry.error = null
    }
}

export const refreshRoomMembers = createAsyncThunk(
    'rooms/refreshMembers',
    async ({ name }: { name: string; sessionGeneration: number }): Promise<ApiResult<RoomReadResult>> => loadRoom(name, 1),
    {
        condition: ({ name, sessionGeneration }, { getState }) => {
            const { auth, rooms } = getState() as RoomStore
            return !!name.trim() && auth.authStatus === 'authenticated'
                && auth.connectionStatus === 'connected'
                && auth.sessionGeneration === sessionGeneration
                && !rooms.byKey[roomKey(name)]?.loading
        },
    },
)

const roomsSlice = createSlice({
    name: 'rooms',
    initialState: initialState(),
    reducers: {
        roomLeaveUncertain(state, { payload }: PayloadAction<{ name: string; sessionGeneration: number }>) {
            if (state.sessionGeneration !== payload.sessionGeneration) return
            const entry = roomEntry(state, payload.name)
            if (entry.room.membership !== 'left' && entry.room.membership !== 'owner') {
                entry.room.membership = 'unknown'
                entry.leaveUncertain = true
            }
        },
        roomLeft(state, { payload }: PayloadAction<{ name: string; sessionGeneration: number }>) {
            if (state.sessionGeneration !== payload.sessionGeneration) return
            const entry = roomEntry(state, payload.name)
            entry.room.membership = 'left'
            entry.leaveUncertain = false
        },
        roomConfirmed(state, { payload }: PayloadAction<Room>) {
            const entry = roomEntry(state, payload.name)
            entry.leaveUncertain = false
            const previous = entry.room
            entry.room = {
                ...previous,
                ...payload,
                owner: payload.ownerKnown ? payload.owner : previous.owner,
                ownerKnown: payload.ownerKnown || previous.ownerKnown,
                members: payload.membersKnown ? payload.members : previous.members,
                membersKnown: payload.membersKnown || previous.membersKnown,
                membership: payload.membership,
            }
            if (payload.membersKnown) {
                entry.loadedAt = new Date().toISOString()
                entry.error = null
            }
        },
    },
    extraReducers: builder => {
        builder
            .addCase(sessionChecking, state => resetState(state))
            .addCase(sessionCleared, state => resetState(state))
            .addCase(sessionStarted, (state, action) => ({ ...resetState(state), currentUser: action.payload }))
            .addCase(fetchHistoryPage.fulfilled, (state, action) => {
                if (action.payload.status !== 'success' || !action.payload.data.room) return
                if (action.meta.arg.sessionGeneration !== state.sessionGeneration) return
                mergeMetadata(state, action.payload.data.room)
            })
            .addCase(refreshRoomMembers.pending, (state, action) => {
                if (action.meta.arg.sessionGeneration !== state.sessionGeneration) return
                const entry = roomEntry(state, action.meta.arg.name)
                entry.loading = true
                entry.requestId = action.meta.requestId
            })
            .addCase(refreshRoomMembers.fulfilled, (state, action) => {
                if (action.meta.arg.sessionGeneration !== state.sessionGeneration) return
                const entry = state.byKey[roomKey(action.meta.arg.name)]
                if (entry?.requestId !== action.meta.requestId) return
                entry.loading = false
                delete entry.requestId
                if (action.payload.status === 'success') {
                    mergeMetadata(state, action.payload.data)
                    if (!action.payload.data.membersKnown) {
                        entry.error = { kind: 'parse', message: 'Phản hồi chưa có danh sách thành viên mới. Hãy thử lại.' }
                    }
                } else entry.error = action.payload.error
            })
            .addCase(refreshRoomMembers.rejected, (state, action) => {
                if (action.meta.arg.sessionGeneration !== state.sessionGeneration) return
                const entry = state.byKey[roomKey(action.meta.arg.name)]
                if (entry?.requestId !== action.meta.requestId) return
                entry.loading = false
                delete entry.requestId
                entry.error = { kind: 'connection', message: 'Không tải được thành viên phòng.' }
            })
    },
})

export const { roomConfirmed, roomLeaveUncertain, roomLeft } = roomsSlice.actions
export default roomsSlice.reducer
