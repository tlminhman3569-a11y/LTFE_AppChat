import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import LogoutDialog from '../src/features/auth/LogoutDialog'

describe('Hộp xác nhận đăng xuất', () => {
    it('cảnh báo mất bản nháp và cho chọn Hủy hoặc Tiếp tục', () => {
        const dialog = createElement(LogoutDialog, { onCancel: vi.fn(), onConfirm: vi.fn() })

        const html = renderToStaticMarkup(dialog)

        expect(html).toContain('aria-describedby="logout-warning"')
        expect(html).toContain('Đăng xuất sẽ xóa bản nháp')
        expect(html).toContain('>Hủy</button>')
        expect(html).toContain('>Tiếp tục</button>')
    })

    it('render hộp xác nhận không gọi callback đăng xuất', () => {
        const confirmLogout = vi.fn()
        const dialog = createElement(LogoutDialog, { onCancel: vi.fn(), onConfirm: confirmLogout })

        renderToStaticMarkup(dialog)

        expect(confirmLogout).not.toHaveBeenCalled()
    })
})
