interface ImagePickerProps {
    file?: File
    previewUrl?: string
    uploading?: boolean
    error?: string
    notice?: string
    canSend: boolean
    onSelect: (file: File) => void
    onRemove: () => void
    onSend: () => void
}

export default function ImagePicker({ file, previewUrl, uploading, error, notice, canSend, onSelect, onRemove, onSend }: ImagePickerProps) {
    return (
        <div className="image-picker" aria-label="Ảnh nháp">
            <label>
                Chọn ảnh
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canSend || uploading}
                    onChange={event => {
                        const selected = event.currentTarget.files?.[0]
                        event.currentTarget.value = ''
                        if (selected) onSelect(selected)
                    }} />
            </label>
            <small>Một ảnh JPEG, PNG hoặc WebP, tối đa 5 MiB. Ảnh và tin chữ gửi riêng.</small>
            {file && <>
                <img className="image-preview" src={previewUrl} alt="Ảnh xem trước, chưa gửi" />
                <span>{file.name}</span>
                <small>Đang giữ ảnh nháp cho hội thoại này.</small>
                <div>
                    <button type="button" onClick={onRemove}>Bỏ ảnh</button>
                    <button type="button" disabled={!canSend || uploading} onClick={onSend}>
                        {uploading ? 'Đang upload…' : 'Gửi ảnh'}
                    </button>
                </div>
            </>}
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
        </div>
    )
}
