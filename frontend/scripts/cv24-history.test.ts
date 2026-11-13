import { afterEach, expect, it, vi } from 'vitest'
import { loadHistory } from '../src/services/chatApi'
import { loadRoom } from '../src/services/roomsApi'
import { socketClient, SocketRequestError } from '../src/services/socketClient'

vi.mock('../src/services/roomsApi', () => ({ loadRoom: vi.fn() }))
afterEach(() => vi.restoreAllMocks())

const people = { kind: 'people', name: 'Ban_Mau' } as const
const sample = { id: 12, type: 0, name: 'Ban_Mau', to: 'kiet_demo', mes: 'Chào 😊', createAt: '2026-11-13 08:01:00' }

it('đọc đúng trang qua socket dùng chung và giữ nguyên dữ liệu', async () => {
    const request = vi.spyOn(socketClient, 'request').mockResolvedValue({
        event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [sample],
    })
    const connect = vi.spyOn(socketClient, 'connect')
    expect(await loadHistory(people, 2, 'kiet_demo')).toEqual({
        status: 'success',
        data: { conversation: people, page: 2, messages: [{ id: sample.id, name: sample.name, to: sample.to, mes: sample.mes, createAt: sample.createAt, kind: 'people' }] },
    })
    expect(request).toHaveBeenCalledExactlyOnceWith('GET_PEOPLE_CHAT_MES', { name: 'Ban_Mau', page: 2 })
    expect(connect).not.toHaveBeenCalled()
})

it('phân biệt mảng rỗng với phản hồi sai kiểu hoặc sai hội thoại', async () => {
    const request = vi.spyOn(socketClient, 'request')
    for (const data of [null, [{ ...sample, name: 'Nguoi_Khac' }], [{ ...sample, type: 1 }]]) {
        request.mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data })
        expect(await loadHistory(people, 1, 'kiet_demo')).toMatchObject({ status: 'error', error: { kind: 'parse' } })
    }
    request.mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [] })
    expect(await loadHistory(people, 3, 'kiet_demo')).toMatchObject({ status: 'success', data: { page: 3, messages: [] } })
})

it('phân biệt máy chủ từ chối, mất kết nối và timeout', async () => {
    const request = vi.spyOn(socketClient, 'request')
    request.mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'error' })
    request.mockRejectedValueOnce(new SocketRequestError('offline', 'connection', false))
    request.mockRejectedValueOnce(new SocketRequestError('timeout', 'timeout', true))
    expect(await loadHistory(people, 1, 'kiet_demo')).toMatchObject({ status: 'error', error: { kind: 'business' } })
    expect(await loadHistory(people, 1, 'kiet_demo')).toMatchObject({ status: 'error', error: { kind: 'connection' } })
    expect(await loadHistory(people, 1, 'kiet_demo')).toMatchObject({ status: 'unknown', error: { kind: 'timeout' } })
})

it('từ chối số trang sai và giao lịch sử phòng cho adapter của Khôi', async () => {
    const request = vi.spyOn(socketClient, 'request')
    const blocker = { status: 'error', error: { kind: 'connection', message: 'Chờ CV45' } } as const
    vi.mocked(loadRoom).mockResolvedValueOnce(blocker)
    expect(await loadHistory(people, 0, 'kiet_demo')).toMatchObject({ status: 'error', error: { kind: 'business' } })
    expect(await loadHistory({ kind: 'room', name: 'Ban_Mau' }, 1, 'kiet_demo')).toEqual(blocker)
    expect(loadRoom).toHaveBeenCalledExactlyOnceWith('Ban_Mau', 1)
    expect(request).not.toHaveBeenCalled()
})

it('chỉ chấp nhận tin giữa tài khoản hiện tại và người bên kia, theo cả hai chiều', async () => {
    const request = vi.spyOn(socketClient, 'request')
    const outgoing = { ...sample, name: sample.to, to: sample.name }
    request.mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [sample, outgoing] })
    expect(await loadHistory(people, 1, 'kiet_demo')).toMatchObject({
        status: 'success', data: { messages: [{ name: 'Ban_Mau', to: 'kiet_demo' }, { name: 'kiet_demo', to: 'Ban_Mau' }] },
    })
    for (const message of [{ ...sample, to: 'Nguoi_Khac' }, { ...outgoing, name: 'Nguoi_Khac' }]) {
        request.mockResolvedValueOnce({ event: 'GET_PEOPLE_CHAT_MES', status: 'success', data: [sample, message] })
        expect(await loadHistory(people, 1, 'kiet_demo')).toMatchObject({ status: 'error', error: { kind: 'parse' } })
    }
    expect(await loadHistory(people, 1, '')).toMatchObject({ status: 'error', error: { kind: 'session' } })
    expect(request).toHaveBeenCalledTimes(3)
})
