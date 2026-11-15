import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkExists, checkOnline } from '../src/services/usersApi'
import { socketClient, SocketRequestError } from '../src/services/socketClient'
import { parseUserExists, parseUserOnline } from '../src/utils/parseUserChecks'

afterEach(() => vi.restoreAllMocks())

describe('CV43: phản hồi CHECK_USER_EXIST và CHECK_USER_ONLINE', () => {
    for (const [event, parse] of [
        ['CHECK_USER_EXIST', (response: unknown) => parseUserExists(response)],
        ['CHECK_USER_ONLINE', (response: unknown) => parseUserOnline(response, '2026-11-15T08:00:00.000Z')],
    ] as const) {
        it(`${event} chấp nhận data.status boolean, dù không có status ngoài cùng`, () => {
            for (const status of [true, false]) {
                const value = parse({ event, data: { status } })
                expect(value.status).toBe('success')
                if (event === 'CHECK_USER_EXIST') {
                    expect(value).toEqual({ status: 'success', data: status })
                } else {
                    expect(value).toEqual({ status: 'success', data: {
                        status: status ? 'online' : 'offline', checkedAt: '2026-11-15T08:00:00.000Z',
                    } })
                }
                expect(parse({ event, status: 'success', data: { status } }).status).toBe('success')
            }
        })

        it(`${event} phân biệt lỗi máy chủ và phản hồi sai`, () => {
            expect(parse({ event, status: 'error', data: { status: true } }))
                .toMatchObject({ status: 'error', error: { kind: 'business' } })
            for (const response of [
                { event, data: {} },
                { event, data: { status: 'true' } },
                { event, status: 'pending', data: { status: true } },
                { event: 'OTHER_EVENT', status: 'success', data: { status: true } },
                { event, data: { exists: true } },
                { event, data: null },
                null,
            ]) {
                expect(parse(response)).toMatchObject({ status: 'error', error: { kind: 'parse' } })
            }
        })
    }
})

describe('CV43: service sử dụng đúng WebSocket chung', () => {
    it('gửi tên event thật và giữ nguyên username có phân biệt chữ hoa/thường', async () => {
        const request = vi.spyOn(socketClient, 'request')
        request.mockResolvedValueOnce({ event: 'CHECK_USER_EXIST', data: { status: true } })
        expect(await checkExists('  Ban_Moi  ')).toEqual({ status: 'success', data: true })
        expect(request).toHaveBeenNthCalledWith(1, 'CHECK_USER_EXIST', { user: 'Ban_Moi' })

        request.mockResolvedValueOnce({ event: 'CHECK_USER_ONLINE', data: { status: false } })
        expect(await checkOnline('  Ban_Moi  ')).toMatchObject({ status: 'success', data: { status: 'offline' } })
        expect(request).toHaveBeenNthCalledWith(2, 'CHECK_USER_ONLINE', { user: 'Ban_Moi' })
        expect(request).toHaveBeenCalledTimes(2)
    })

    it('không gửi username rỗng và không đoán người dùng không tồn tại từ timeout', async () => {
        const request = vi.spyOn(socketClient, 'request')
        expect(await checkExists('   ')).toMatchObject({ status: 'error', error: { kind: 'business' } })
        expect(request).not.toHaveBeenCalled()
        request.mockRejectedValueOnce(new SocketRequestError('timeout', 'timeout', true))
        expect(await checkExists('Ban_Moi')).toMatchObject({ status: 'unknown', error: { kind: 'timeout' } })
        request.mockRejectedValueOnce(new SocketRequestError('timeout', 'timeout', true))
        expect(await checkOnline('Ban_Moi')).toMatchObject({ status: 'unknown', error: { kind: 'timeout' } })
    })

    it('phản hồi lỗi hoặc sai schema không mở cuộc chat giả', async () => {
        const request = vi.spyOn(socketClient, 'request')
        request.mockResolvedValueOnce({ event: 'CHECK_USER_EXIST', status: 'error' })
        expect(await checkExists('Ban_Moi')).toMatchObject({ status: 'error', error: { kind: 'business' } })
        request.mockResolvedValueOnce({ event: 'CHECK_USER_EXIST', status: 'success', data: {} })
        expect(await checkExists('Ban_Moi')).toMatchObject({ status: 'error', error: { kind: 'parse' } })
        request.mockRejectedValueOnce(new SocketRequestError('disconnect', 'connection', false))
        expect(await checkOnline('Ban_Moi')).toMatchObject({ status: 'error', error: { kind: 'connection' } })
    })
})
