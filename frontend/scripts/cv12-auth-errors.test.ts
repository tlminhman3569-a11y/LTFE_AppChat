import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, register } from '../src/services/authApi'
import { socketClient } from '../src/services/socketClient'

beforeEach(() => {
    vi.spyOn(socketClient, 'connect').mockResolvedValue(undefined)
    vi.spyOn(socketClient, 'disconnect').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('Máy chủ từ chối đăng nhập và đăng ký', () => {
    it('đóng socket khi sai mật khẩu và cho đăng nhập lại', async () => {
        const reqSpy = vi.spyOn(socketClient, 'request')
            .mockResolvedValueOnce({ event: 'LOGIN', status: 'error' })
            .mockResolvedValueOnce({
                event: 'LOGIN', status: 'success', data: { RE_LOGIN_CODE: 'new-code' },
            })

        const failed = await login('demo', 'wrong-password')

        expect(failed).toMatchObject({ status: 'error', error: { kind: 'business' } })
        expect(socketClient.disconnect).toHaveBeenCalledOnce()

        const res = await login('demo', 'sample-password')

        expect(res).toEqual({ status: 'success', data: { username: 'demo', reLoginCode: 'new-code' } })
        expect(socketClient.connect).toHaveBeenCalledTimes(2)
        expect(reqSpy).toHaveBeenLastCalledWith('LOGIN', { user: 'demo', pass: 'sample-password' })
    })

    it('trả lỗi trùng tên để form báo ngay ở ô username', async () => {
        const reqSpy = vi.spyOn(socketClient, 'request').mockResolvedValue({
            event: 'REGISTER', status: 'error', mes: 'User already exists!',
        })

        const res = await register('demo', 'sample-password')

        expect(res).toEqual({
            status: 'error',
            error: { kind: 'business', code: 'username_taken', message: 'Tên đăng nhập đã được sử dụng' },
        })
        expect(reqSpy).toHaveBeenCalledExactlyOnceWith('REGISTER', { user: 'demo', pass: 'sample-password' })
    })
})
