import { useEffect, useRef } from 'react'
import './logout-dialog.css'

interface Props {
    onCancel: () => void
    onConfirm: () => void
}

export default function LogoutDialog({ onCancel, onConfirm }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return

        dialog.showModal()
        return () => dialog.close()
    }, [])

    function cancel() {
        dialogRef.current?.close()
        onCancel()
    }

    return (
        <dialog
            ref={dialogRef}
            className="logout-dialog"
            aria-labelledby="logout-title"
            aria-describedby="logout-warning"
            onCancel={event => {
                event.preventDefault()
                cancel()
            }}
        >
            <h2 id="logout-title">Đăng xuất?</h2>
            <p id="logout-warning">Bạn còn bản nháp chưa gửi. Đăng xuất sẽ xóa bản nháp</p>
            <div className="logout-dialog-actions">
                <button type="button" autoFocus onClick={cancel}>Hủy</button>
                <button type="button" onClick={onConfirm}>Tiếp tục</button>
            </div>
        </dialog>
    )
}
