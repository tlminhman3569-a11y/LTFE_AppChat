export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

export const maxImageBytes = 5 * 1024 * 1024
export const imageMimeTypes: ImageMimeType[] = ['image/jpeg', 'image/png', 'image/webp']

export const imageMessagePrefix = 'APPCHAT_IMAGE_V1'
export { maxMessageBytes as maxImageMessageBytes } from './message'

export interface UploadedImage {
    url: string
    publicId: string
    mimeType: ImageMimeType
    bytes: number
    width: number
    height: number
}

export interface ImageMessageContent {
    version: 1
    type: 'image'
    clientMessageId: string
    image: UploadedImage
}

export type UploadResult =
    | {
        status: 'success'
        data: UploadedImage
    }
    | {
        status: 'error'
        error: {
            kind: 'config' | 'validation' | 'http' | 'network' | 'parse' | 'aborted'
            message: string
            statusCode?: number
        }
    }
