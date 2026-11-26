export function isCloudinaryImageUrl(value: string, cloudName: string): boolean {
    try {
        // URL có thể đổi đường dẫn khi trình duyệt xử lý .. hoặc dấu gạch chéo ngược
        const url = new URL(value)
        return url.protocol === 'https:'
            && url.hostname === 'res.cloudinary.com'
            && !url.port && !url.username && !url.password
            && url.pathname.startsWith(`/${cloudName}/image/upload/`)
    } catch {
        return false
    }
}
