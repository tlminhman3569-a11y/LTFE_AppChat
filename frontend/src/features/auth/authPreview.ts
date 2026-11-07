import type { ApiResult } from '../../types/api'

export type PreviewResult = 'success' | 'rejected' | 'connection'

// Chỉ dùng thử giao diện CV04, không gửi tài khoản lên máy chủ.
export async function submitPreview(
    mode: 'login' | 'register',
    result: PreviewResult,
): Promise<ApiResult<null>> {
    if (!import.meta.env.DEV) {
        return { status: 'error', error: { kind: 'connection', message: 'Chức năng hiện chưa sẵn sàng. Vui lòng thử lại sau.' } }
    }

    await new Promise(resolve => setTimeout(resolve, 600))

    if (result === 'connection') {
        return { status: 'error', error: { kind: 'connection', message: 'Không thể kết nối. Vui lòng thử lại.' } }
    }
    if (result === 'rejected') {
        return {
            status: 'error',
            error: {
                kind: 'business',
                message: mode === 'login'
                    ? 'Tên đăng nhập hoặc mật khẩu không đúng.'
                    : 'Tên đăng nhập đã được sử dụng.',
            },
        }
    }
    return { status: 'success', data: null }
}
