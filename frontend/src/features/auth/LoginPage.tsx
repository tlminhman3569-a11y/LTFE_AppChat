import { useState } from 'react'
import AuthForm from './AuthForm'
import './auth.css'

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [registeredUser, setRegisteredUser] = useState('')
    const isRegister = mode === 'register'

    function changeMode(nextMode: 'login' | 'register') {
        if (nextMode === mode) return
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
                    ? 'Tạo tài khoản để bắt đầu trò chuyện.'
                    : 'Đăng nhập để tiếp tục cuộc trò chuyện.'}</p>
                <div className="auth-switch" aria-label="Chọn đăng nhập hoặc đăng ký">
                    <button type="button" aria-pressed={!isRegister} onClick={() => changeMode('login')}>Đăng nhập</button>
                    <button type="button" aria-pressed={isRegister} onClick={() => changeMode('register')}>Đăng ký</button>
                </div>
                {registeredUser && <p role="status" className="auth-notice">Đăng ký thành công (dữ liệu mẫu). Vui lòng đăng nhập</p>}
                <AuthForm key={`${mode}-${registeredUser}`} mode={mode}
                    initialUsername={registeredUser} onRegistered={handleRegistered} />
                <button className="auth-footer" type="button" onClick={() => changeMode(isRegister ? 'login' : 'register')}>
                    {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
                </button>
            </section>
        </main>
    )
}
