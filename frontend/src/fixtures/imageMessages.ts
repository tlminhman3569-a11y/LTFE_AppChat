import type { ImageMessageContent, UploadedImage } from '../types/media'

// URL mẫu không tải được ảnh, chỉ dùng để ghép dữ liệu
export const fakeImage: UploadedImage = {
    url: 'https://images.example.com/appchat/anh-thu.jpg',
    publicId: 'appchat/anh-thu',
    mimeType: 'image/jpeg',
    bytes: 125000,
    width: 800,
    height: 600,
}

export const fakeImageMessage: ImageMessageContent = {
    version: 1,
    type: 'image',
    clientMessageId: '55aabbcc00112233445566778899aabbcc',
    image: fakeImage,
}
