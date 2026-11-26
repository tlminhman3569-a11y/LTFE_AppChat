import { fetchJson } from './apiClient'
import { isCloudinaryImageUrl } from '../utils/imageUrl'
import { imageMimeTypes, maxImageBytes } from '../types/media'
import type { ImageMimeType, UploadResult } from '../types/media'

interface CloudinaryImage {
    secure_url: string
    public_id: string
    resource_type: string
    format: string
    bytes: number
    width: number
    height: number
}

export async function uploadImage(file: File, signal?: AbortSignal): Promise<UploadResult> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim()
    const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim()

    if (!cloudName || !preset || !/^[a-z0-9_-]+$/i.test(cloudName)) {
        return { status: 'error', error: { kind: 'config', message: 'Kiểm tra lại cloud name và upload preset' } }
    }
    if (!imageMimeTypes.some(mime => mime === file.type)) {
        return { status: 'error', error: { kind: 'validation', message: 'Chỉ chọn ảnh JPEG, PNG hoặc WebP' } }
    }
    if (file.size === 0) {
        return { status: 'error', error: { kind: 'validation', message: 'File ảnh đang trống' } }
    }
    if (file.size > maxImageBytes) {
        return { status: 'error', error: { kind: 'validation', message: 'Ảnh lớn hơn 5 MiB, chọn ảnh nhỏ hơn' } }
    }
    if (signal?.aborted) {
        return { status: 'error', error: { kind: 'aborted', message: 'Đã hủy upload ảnh' } }
    }

    const body = new FormData()
    body.append('file', file)
    body.append('upload_preset', preset)

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    const res = await fetchJson<CloudinaryImage>(url, {
        method: 'POST',
        body,
        signal,
        credentials: 'omit',
    })
    if (res.status === 'error') return res

    const image = res.data
    if (typeof image?.secure_url !== 'string' || !isCloudinaryImageUrl(image.secure_url, cloudName)
        || typeof image.public_id !== 'string' || !image.public_id.trim()
        || image.resource_type !== 'image') {
        return { status: 'error', error: { kind: 'parse', message: 'Cloudinary chưa trả về URL ảnh dùng được' } }
    }

    if (typeof image.bytes !== 'number' || image.bytes <= 0 || image.bytes > maxImageBytes
        || typeof image.width !== 'number' || image.width <= 0
        || typeof image.height !== 'number' || image.height <= 0) {
        return { status: 'error', error: { kind: 'parse', message: 'Thiếu thông tin dung lượng hoặc kích thước ảnh' } }
    }

    let mimeType: ImageMimeType
    if (image.format === 'jpg' || image.format === 'jpeg') mimeType = 'image/jpeg'
    else if (image.format === 'png') mimeType = 'image/png'
    else if (image.format === 'webp') mimeType = 'image/webp'
    else return { status: 'error', error: { kind: 'parse', message: 'Cloudinary trả về định dạng ảnh chưa hỗ trợ' } }

    return {
        status: 'success',
        data: {
            url: image.secure_url,
            publicId: image.public_id,
            mimeType,
            bytes: image.bytes,
            width: image.width,
            height: image.height,
        },
    }
}
