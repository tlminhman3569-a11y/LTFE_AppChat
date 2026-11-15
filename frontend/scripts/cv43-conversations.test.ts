import { describe, expect, it } from 'vitest'
import conversationsReducer, {
    conversationVerified, refreshConversations,
} from '../src/store/slices/conversationsSlice'
import { sessionCleared, sessionStarted } from '../src/store/slices/authSlice'

const outsideFixture = { kind: 'people', name: 'Ban_Moi' } as const
const roomSameName = { kind: 'room', name: 'Ban_Moi' } as const

describe('CV43: danh sách chat riêng đã xác minh trong phiên', () => {
    it('chỉ thêm một lần và phân biệt chat riêng với phòng trùng tên', () => {
        let state = conversationsReducer(undefined, { type: '@@init' })
        state = conversationsReducer(state, conversationVerified(outsideFixture))
        state = conversationsReducer(state, conversationVerified(outsideFixture))
        state = conversationsReducer(state, conversationVerified(roomSameName))
        expect(state.items).toEqual([roomSameName, outsideFixture])
        expect(state.verified).toEqual([roomSameName, outsideFixture])
    })

    it('giữ người đã kiểm tra khi GET_USER_LIST không chứa người đó', () => {
        let state = conversationsReducer(undefined, conversationVerified(outsideFixture))
        state = conversationsReducer(state, refreshConversations.pending('first', 3))
        state = conversationsReducer(state, refreshConversations.fulfilled({
            status: 'success', data: [{ kind: 'people', name: 'Ban_Cu' }],
        }, 'first', 3))
        expect(state.items).toEqual([outsideFixture, { kind: 'people', name: 'Ban_Cu' }])

        state = conversationsReducer(state, refreshConversations.pending('second', 3))
        state = conversationsReducer(state, refreshConversations.fulfilled({
            status: 'success', data: [outsideFixture, { kind: 'room', name: 'Phong_A' }],
        }, 'second', 3))
        expect(state.items).toEqual([outsideFixture, { kind: 'room', name: 'Phong_A' }])
    })

    it('không ghi nhận cuộc chat chưa xác minh và xóa mục cục bộ khi đổi phiên', () => {
        let state = conversationsReducer(undefined, { type: '@@init' })
        expect(state.items).toEqual([])
        state = conversationsReducer(state, conversationVerified(outsideFixture))
        state = conversationsReducer(state, sessionCleared({}))
        expect(state.items).toEqual([])
        expect(state.verified).toEqual([])
        state = conversationsReducer(state, conversationVerified(outsideFixture))
        state = conversationsReducer(state, sessionStarted('nguoi_khac'))
        expect(state.verified).toEqual([])
    })
})
