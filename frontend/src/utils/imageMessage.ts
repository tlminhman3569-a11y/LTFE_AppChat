import type { ApiResult } from '../types/api'
import { imageMessagePrefix, imageMimeTypes, maxImageBytes, maxImageMessageBytes } from '../types/media'
import type { ImageMessageContent } from '../types/media'
import { isCloudinaryImageUrl } from './imageUrl'

function isImageContent(value: unknown): value is ImageMessageContent {
    if (typeof value !== 'object' || value === null) return false
    const content = value as Partial<ImageMessageContent>
    const image = content.image
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim()
    if (!cloudName) return false
    return content.version === 1 && content.type === 'image'
        && typeof content.clientMessageId === 'string' && /^[a-f0-9]{32}$/.test(content.clientMessageId)
        && typeof image === 'object' && image !== null
        && typeof image.url === 'string' && isCloudinaryImageUrl(image.url, cloudName)
        && typeof image.publicId === 'string' && Boolean(image.publicId.trim())
        && imageMimeTypes.includes(image.mimeType)
        && Number.isFinite(image.bytes) && image.bytes > 0 && image.bytes <= maxImageBytes
        && Number.isFinite(image.width) && image.width > 0
        && Number.isFinite(image.height) && image.height > 0
}

export function parseImageMessage(mes: string): ImageMessageContent | null {
    if (!mes.startsWith(imageMessagePrefix)) return null
    const json = mes.slice(imageMessagePrefix.length)
    if (!json.startsWith('{') || !json.endsWith('}')) return null
    try {
        const content: unknown = JSON.parse(json)
        return isImageContent(content) ? content : null
    } catch {
        return null
    }
}

export function serializeImageMessage(content: ImageMessageContent): ApiResult<string> {
    if (!isImageContent(content)) {
        return { status: 'error', error: { kind: 'parse', message: 'Thông tin ảnh không hợp lệ.' } }
    }
    const { url, publicId, mimeType, bytes, width, height } = content.image
    const json = JSON.stringify({ version: 1, type: 'image', clientMessageId: content.clientMessageId,
        image: { url, publicId, mimeType, bytes, width, height } })
    const mes = imageMessagePrefix + json.replace(/[\u007f-\uffff]/g, unit =>
        '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'))
    if (new TextEncoder().encode(mes).length > maxImageMessageBytes) {
        return { status: 'error', error: { kind: 'business', message: 'Tin ảnh vượt giới hạn 1.900 byte. Không thể gửi URL này.' } }
    }
    return { status: 'success', data: mes }
}
