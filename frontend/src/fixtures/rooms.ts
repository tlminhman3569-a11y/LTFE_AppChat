import type { ApiResult } from '../types/api'
import type { Room, RoomReadResult } from '../types/room'

export const rooms: Room[] = [
    {
        name: 'nhom_hoc',
        owner: 'man_demo',
        ownerKnown: true,
        members: ['man_demo', 'khoi_demo', 'kiet_demo'],
        membersKnown: true,
        membership: 'member',
    },
    {
        name: 'nhom_du_an',
        owner: 'khoi_demo',
        ownerKnown: true,
        members: ['khoi_demo', 'man_demo'],
        membersKnown: true,
        membership: 'owner',
    },
    {
        name: 'minh_an',
        owner: 'kiet_demo',
        ownerKnown: true,
        membersKnown: false,
        membership: 'unknown',
    },
    {
        name: 'phong_khong_ro',
        ownerKnown: false,
        membersKnown: false,
        membership: 'unknown',
    },
    {
        name: 'phong_da_roi',
        owner: 'man_demo',
        ownerKnown: true,
        members: ['man_demo'],
        membersKnown: true,
        membership: 'left',
    },
    {
        name: 'phong_trong',
        ownerKnown: false,
        members: [],
        membersKnown: true,
        membership: 'unknown',
    },
]

export const roomReadSuccess: ApiResult<RoomReadResult> = {
    status: 'success',
    data: {
        roomName: 'nhom_hoc',
        page: 1,
        messages: [],
        owner: 'man_demo',
        ownerKnown: true,
        members: ['man_demo', 'khoi_demo', 'kiet_demo'],
        membersKnown: true,
        membership: 'member',
    },
}

export const roomReadWithoutMetadata: ApiResult<RoomReadResult> = {
    status: 'success',
    data: {
        roomName: 'nhom_hoc',
        page: 2,
        messages: [],
        ownerKnown: false,
        membersKnown: false,
        membership: 'unknown',
    },
}

export const roomReadEmptyMembers: ApiResult<RoomReadResult> = {
    status: 'success',
    data: {
        roomName: 'phong_trong',
        page: 1,
        messages: [],
        ownerKnown: false,
        members: [],
        membersKnown: true,
        membership: 'unknown',
    },
}

export const roomReadError: ApiResult<RoomReadResult> = {
    status: 'error',
    error: { kind: 'connection', message: 'Không tải được phòng mẫu' },
}

export const roomReadUnknown: ApiResult<RoomReadResult> = {
    status: 'unknown',
    error: { kind: 'timeout', message: 'Chưa xác định được kết quả tải phòng mẫu' },
}
