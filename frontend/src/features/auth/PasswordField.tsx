import { useState } from 'react'

interface PasswordFieldProps {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
    error: string
    autoComplete: 'current-password' | 'new-password'
    disabled: boolean
}

export default function PasswordField({ id, label, value, onChange, error, autoComplete, disabled }: PasswordFieldProps) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <div className="auth-field">
            <label htmlFor={id}>{label}</label>
            <div className="password-input">
                <input id={id} name={id} type={isVisible ? 'text' : 'password'}
                    value={value} onChange={event => onChange(event.target.value)}
                    autoComplete={autoComplete} disabled={disabled} required
                    aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
                <button type="button" onClick={() => setIsVisible(!isVisible)} disabled={disabled}
                    aria-label={`${isVisible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} aria-pressed={isVisible}>
                    {isVisible ? 'Ẩn' : 'Hiện'}
                </button>
            </div>
            {error && <p id={`${id}-error`} className="field-error">{error}</p>}
        </div>
    )
}
