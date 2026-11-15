import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkExists, checkOnline } from '../src/services/usersApi'
import { SocketRequestError, socketClient } from '../src/services/socketClient'

afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('CV43 - kiểm tra username chính xác', () => {
    it('gửi đúng sự kiện và username, mở được khi status true', async () => {
        const request = vi.spyOn(socketClient, 'request').mockResolvedValue({
            event: 'CHECK_USER_EXIST', status: 'success', data: { status: true },
        })
        expect(await checkExists('Minh_1')).toEqual({ status: 'success', data: true })
        expect(request).toHaveBeenCalledTimes(1)
        expect(request).toHaveBeenCalledWith('CHECK_USER_EXIST', { user: 'Minh_1' })
    })

    it('status false là không tồn tại, không phải lỗi', async () => {
        vi.spyOn(socketClient, 'request').mockResolvedValue({
            event: 'CHECK_USER_EXIST', status: 'success', data: { status: false },
        })
        expect(await checkExists('khong_co')).toEqual({ status: 'success', data: false })
    })

    it('không gửi lệnh khi tên trống hoặc chứa ký tự không hợp lệ', async () => {
        const request = vi.spyOn(socketClient, 'request')
        expect((await checkExists('  ')).status).toBe('error')
        expect((await checkExists('hai ten')).status).toBe('error')
        expect(request).not.toHaveBeenCalled()
    })

    it('không kết luận tài khoản không tồn tại khi response sai hoặc server từ chối', async () => {
        const request = vi.spyOn(socketClient, 'request')
        request.mockResolvedValueOnce({ event: 'CHECK_USER_EXIST', status: 'success', data: { status: 'false' } })
        request.mockResolvedValueOnce({ event: 'CHECK_USER_ONLINE', status: 'success', data: { status: true } })
        request.mockResolvedValueOnce({ event: 'CHECK_USER_EXIST', status: 'error', mes: 'Server error' })
        for (let i = 0; i < 3; i++) {
            const result = await checkExists('test')
            expect(result.status).toBe('error')
            if (result.status === 'error') expect(result.error.kind).toBe(i === 2 ? 'business' : 'parse')
        }
    })

    it('timeout sau khi gửi được báo chưa xác định, lỗi trước gửi được báo error', async () => {
        const request = vi.spyOn(socketClient, 'request')
        request.mockRejectedValueOnce(new SocketRequestError('timeout', 'timeout', true))
        request.mockRejectedValueOnce(new SocketRequestError('no socket', 'connection', false))
        const timedOut = await checkExists('test')
        const disconnected = await checkExists('test')
        expect(timedOut.status).toBe('unknown')
        expect(disconnected.status).toBe('error')
    })
})

describe('CV43 - trạng thái online theo lần kiểm tra', () => {
    it('chuẩn hóa true thành online, false thành offline và có timestamp', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-15T08:30:00.000Z'))
        const request = vi.spyOn(socketClient, 'request')
        request.mockResolvedValueOnce({ event: 'CHECK_USER_ONLINE', status: 'success', data: { status: true } })
        request.mockResolvedValueOnce({ event: 'CHECK_USER_ONLINE', status: 'success', data: { status: false } })
        expect(await checkOnline('Minh_1')).toEqual({
            status: 'success', data: { status: 'online', checkedAt: '2026-11-15T08:30:00.000Z' },
        })
        expect(await checkOnline('Minh_1')).toEqual({
            status: 'success', data: { status: 'offline', checkedAt: '2026-11-15T08:30:00.000Z' },
        })
        expect(request).toHaveBeenCalledWith('CHECK_USER_ONLINE', { user: 'Minh_1' })
    })

    it('không tự coi lỗi/mất mạng là offline', async () => {
        const request = vi.spyOn(socketClient, 'request')
        request.mockResolvedValueOnce({ event: 'CHECK_USER_ONLINE', status: 'success', data: {} })
        request.mockRejectedValueOnce(new SocketRequestError('timeout', 'timeout', true))
        const invalid = await checkOnline('test')
        const timedOut = await checkOnline('test')
        expect(invalid.status).toBe('error')
        expect(timedOut.status).toBe('unknown')
    })
})
