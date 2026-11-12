import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch } from '../../store/hooks'
import { sessionStarted } from '../../store/slices/authSlice'
import { login, register } from '../../services/authApi'
import { socketClient } from '../../services/socketClient'
import PasswordField from './PasswordField'

function validateUsername(username: string) {
    if (!username.trim()) return 'Vui lòng nhập tên đăng nhập'
    // Quy ước theo thiết kế, cần đối chiếu lại khi nối API thật
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return 'Chỉ dùng chữ cái không dấu, số và dấu gạch dưới (_)'
    }
    return ''
}

interface AuthFormProps {
    mode: 'login' | 'register'
    onRegistered: (username: string) => void
    initialUsername?: string
    isSubmitting: boolean
    setIsSubmitting: (value: boolean) => void
}

export default function AuthForm({ mode, onRegistered, initialUsername = '', isSubmitting, setIsSubmitting }: AuthFormProps) {
    const dispatch = useAppDispatch()
    const [username, setUsername] = useState(initialUsername)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [fieldErrors, setFieldErrors] = useState({ username: '', password: '', confirmPassword: '' })
    const [formError, setFormError] = useState('')
    // Chặn cả hai lần submit sát nhau, trước khi React kịp cập nhật nút
    const pendingSubmit = useRef(false)
    const isMounted = useRef(false)
    const isRegister = mode === 'register'
    let submitLabel = isRegister ? 'Đăng ký' : 'Đăng nhập'
    if (isSubmitting) submitLabel = 'Đang xử lý…'

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (pendingSubmit.current) return

        const errors = {
            username: validateUsername(username),
            password: password ? '' : 'Vui lòng nhập mật khẩu',
            confirmPassword: '',
        }
        if (isRegister) {
            if (!confirmPassword) {
                errors.confirmPassword = 'Vui lòng xác nhận mật khẩu'
            } else if (password !== confirmPassword) {
                errors.confirmPassword = 'Mật khẩu xác nhận không khớp'
            }
        }

        setFieldErrors(errors)
        setFormError('')
        if (Object.values(errors).some(Boolean)) {
            let firstError = 'confirm-password'
            if (errors.password) firstError = 'password'
            if (errors.username) firstError = 'username'
            event.currentTarget.querySelector<HTMLInputElement>(`#${firstError}`)?.focus()
            return
        }

        pendingSubmit.current = true
        setIsSubmitting(true)
        try {
            const result = isRegister ? await register(username, password) : await login(username, password)
            if (!isMounted.current) {
                if (!isRegister && result.status === 'success') socketClient.disconnect()
                return
            }
            if (result.status !== 'success') {
                setFormError(result.error.message)
                return
            }
            setPassword('')
            setConfirmPassword('')
            if (isRegister) onRegistered(username)
            else dispatch(sessionStarted(username))
        } catch {
            if (isMounted.current) setFormError('Có lỗi xảy ra, vui lòng thử lại')
        } finally {
            pendingSubmit.current = false
            if (isMounted.current) setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
            <div className="auth-field">
                <label htmlFor="username">Tên đăng nhập</label>
                <input id="username" name="username" value={username}
                    onChange={event => {
                        setUsername(event.target.value)
                        setFieldErrors({ ...fieldErrors, username: '' })
                        setFormError('')
                    }}
                    autoComplete="username" autoCapitalize="none" spellCheck={false}
                    disabled={isSubmitting} required aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={fieldErrors.username ? 'username-error' : 'username-hint'} />
                {fieldErrors.username
                    ? <p id="username-error" className="field-error">{fieldErrors.username}</p>
                    : <small id="username-hint">Chỉ dùng chữ cái không dấu, số và dấu gạch dưới (_)</small>}
            </div>
            <PasswordField id="password" label="Mật khẩu" value={password}
                onChange={value => {
                    setPassword(value)
                    setFieldErrors({ ...fieldErrors, password: '', confirmPassword: '' })
                    setFormError('')
                }} error={fieldErrors.password}
                autoComplete={isRegister ? 'new-password' : 'current-password'} disabled={isSubmitting} />
            {isRegister && <PasswordField id="confirm-password" label="Xác nhận mật khẩu"
                value={confirmPassword} onChange={value => {
                    setConfirmPassword(value)
                    setFieldErrors({ ...fieldErrors, confirmPassword: '' })
                    setFormError('')
                }} error={fieldErrors.confirmPassword}
                autoComplete="new-password" disabled={isSubmitting} />}
            {formError && <p role="alert" className="auth-error">{formError}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
                {submitLabel}
            </button>
        </form>
    )
}
