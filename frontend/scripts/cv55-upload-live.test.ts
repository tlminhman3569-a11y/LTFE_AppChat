import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { env } from 'node:process'
import { uploadImage } from '../src/services/uploadApi'

const path = env.APPCHAT_UPLOAD_FILE ?? ''
const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
}

describe('upload ảnh lên Cloudinary thật', () => {
    it.skipIf(!path)('upload file đã chọn rồi đọc lại ảnh bằng URL trả về', async () => {
        const bytes = await readFile(path)
        const name = basename(path)
        const mime = mimeTypes[extname(name).toLowerCase()] ?? ''
        const file = new File([new Uint8Array(bytes)], name, { type: mime })

        const res = await uploadImage(file, AbortSignal.timeout(30000))

        if (res.status === 'error') throw new Error(res.error.message)
        expect(res.data.bytes).toBeGreaterThan(0)
        expect(res.data.width).toBeGreaterThan(0)
        expect(res.data.height).toBeGreaterThan(0)

        const reply = await fetch(res.data.url, { signal: AbortSignal.timeout(15000) })
        const contentType = reply.headers.get('content-type')
        const body = await reply.arrayBuffer()

        expect(reply.ok).toBe(true)
        expect(contentType?.startsWith('image/')).toBe(true)
        expect(body.byteLength).toBeGreaterThan(0)
    }, 60000)
})
