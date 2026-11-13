import { useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import AuthForm from './AuthForm'
import './auth.css'

export default function LoginPage() {
    const { logoutNotConfirmed, restoreError } = useAppSelector(state => state.auth)
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [registeredUser, setRegisteredUser] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isRegister = mode === 'register'

    function changeMode(nextMode: 'login' | 'register') {
        if (isSubmitting || nextMode === mode) return
        setMode(nextMode)
        setRegisteredUser('')
    }

    function handleRegistered(username: string) {
        setRegisteredUser(username)
        setMode('login')
    }

    return (
        <main className="auth-page">
            <header className="auth-header">
                <strong>App Chat</strong>
                <span>Chưa kết nối · Chưa đăng nhập</span>
            </header>
            <section className="auth-panel" aria-labelledby="auth-title">
                <h1 id="auth-title">{isRegister ? 'Tạo tài khoản' : 'Đăng nhập App Chat'}</h1>
                <p className="auth-description">{isRegister
                    ? 'Tạo tài khoản để bắt đầu trò chuyện'
                    : 'Đăng nhập để tiếp tục cuộc trò chuyện'}</p>
                <div className="auth-switch" aria-label="Chọn đăng nhập hoặc đăng ký">
                    <button type="button" disabled={isSubmitting} aria-pressed={!isRegister} onClick={() => changeMode('login')}>Đăng nhập</button>
                    <button type="button" disabled={isSubmitting} aria-pressed={isRegister} onClick={() => changeMode('register')}>Đăng ký</button>
                </div>
                {restoreError && <p role="alert" className="auth-error">{restoreError}</p>}
                {logoutNotConfirmed && (
                    <p role="status" className="auth-notice">
                        Đã đăng xuất trên thiết bị này, chưa có xác nhận từ máy chủ
                    </p>
                )}
                {registeredUser && <p role="status" className="auth-notice">Đăng ký thành công, vui lòng đăng nhập</p>}
                <AuthForm key={`${mode}-${registeredUser}`} mode={mode}
                    initialUsername={registeredUser} onRegistered={handleRegistered}
                    isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} />
                <button className="auth-footer" type="button" disabled={isSubmitting} onClick={() => changeMode(isRegister ? 'login' : 'register')}>
                    {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
                </button>
            </section>
        </main>
    )
}
