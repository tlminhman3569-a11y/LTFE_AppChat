import { readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'
import { isCloudinaryImageUrl } from '../src/utils/imageUrl.ts'
import { createConversationKey } from '../src/utils/conversationKey.ts'
import { fakeImageMessage } from '../src/fixtures/imageMessages.ts'
import { maxMessageBytes } from '../src/types/message.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(here, 'cv51-fixtures')
const cloudName = 'cv51-demo'
const validUrl = 'https://res.cloudinary.com/cv51-demo/image/upload/v123/cv51/anh.png'
const byteLength = value => new TextEncoder().encode(value).length

const mediaTypeSource = readFileSync(join(here, '../src/types/media.ts'), 'utf8')
const mediaDecisionSource = readFileSync(join(here, '../../docs/MEDIA_DECISION.md'), 'utf8')

 test('CV51-01: JPEG/PNG/WebP mẫu đều là ảnh thật, không chứa dữ liệu riêng', () => {
    const jpeg = readFileSync(join(fixtureDir, 'valid-jpeg.jpg'))
    const png = readFileSync(join(fixtureDir, 'valid-png.png'))
    const webp = readFileSync(join(fixtureDir, 'valid-webp.webp'))
    assert.equal(jpeg.subarray(0, 3).toString('hex'), 'ffd8ff')
    assert.equal(jpeg.subarray(-2).toString('hex'), 'ffd9')
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF')
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP')
    for (const path of ['valid-jpeg.jpg', 'valid-png.png', 'valid-webp.webp']) {
        const size = statSync(join(fixtureDir, path)).size
        assert.ok(size > 0 && size < 5 * 1024 * 1024, `${path}: ${size}`)
    }
})

 test('CV51-02: có mẫu file rỗng, sai loại và giả mạo phần mở rộng', () => {
    assert.equal(statSync(join(fixtureDir, 'empty.jpg')).size, 0)
    assert.match(readFileSync(join(fixtureDir, 'not-image.txt'), 'utf8'), /not an image/)
    assert.notEqual(readFileSync(join(fixtureDir, 'fake-jpeg.jpg')).subarray(0, 3).toString('hex'), 'ffd8ff')
})

 test('CV51-03: giới hạn dung lượng và byte mes trùng hợp đồng CV55', () => {
    assert.match(mediaTypeSource, /maxImageBytes\s*=\s*5\s*\*\s*1024\s*\*\s*1024/)
    assert.match(mediaTypeSource, /maxImageMessageBytes\s*}\s*from\s*['"]\.\/message['"]/) // dùng chung maxMessageBytes
    assert.equal(maxMessageBytes, 1900)
    assert.match(mediaDecisionSource, /5 MiB/)
})

 test('CV51-04: hợp đồng tin ảnh có đúng version/type/id và metadata', () => {
    assert.match(mediaTypeSource, /imageMessagePrefix\s*=\s*['"]APPCHAT_IMAGE_V1['"]/) 
    assert.equal(fakeImageMessage.version, 1)
    assert.equal(fakeImageMessage.type, 'image')
    assert.ok(fakeImageMessage.clientMessageId.trim())
    assert.ok(fakeImageMessage.image.publicId.trim())
    assert.ok(['image/jpeg','image/png','image/webp'].includes(fakeImageMessage.image.mimeType))
    assert.ok(fakeImageMessage.image.bytes > 0 && fakeImageMessage.image.bytes <= 5 * 1024 * 1024)
    assert.ok(fakeImageMessage.image.width > 0 && fakeImageMessage.image.height > 0)
})

 test('CV51-05: chuỗi APPCHAT_IMAGE_V1 JSON vừa giới hạn UTF-8, giữ nguyên id', () => {
    const content = { ...fakeImageMessage, image: { ...fakeImageMessage.image, url: validUrl } }
    const mes = `APPCHAT_IMAGE_V1${JSON.stringify(content)}`
    assert.ok(byteLength(mes) <= maxMessageBytes, `payload ${byteLength(mes)} bytes`)
    assert.deepEqual(JSON.parse(mes.slice('APPCHAT_IMAGE_V1'.length)), content)
    assert.equal(JSON.parse(mes.slice('APPCHAT_IMAGE_V1'.length)).clientMessageId, fakeImageMessage.clientMessageId)
    assert.equal(mes.startsWith('APPCHAT_RICH_V1'), false)
})

 test('CV51-06: URL ảnh đúng cloud chấp nhận, http/cổng riêng bị chặn', () => {
    assert.equal(isCloudinaryImageUrl(validUrl, cloudName), true)
    assert.equal(isCloudinaryImageUrl('https://res.cloudinary.com:443/cv51-demo/image/upload/v1/p.png', cloudName), true)
    for (const value of [
        'http://res.cloudinary.com/cv51-demo/image/upload/p.png',
        'https://res.cloudinary.com:444/cv51-demo/image/upload/p.png',
        'https://attacker@res.cloudinary.com/cv51-demo/image/upload/p.png',
        'https://res.cloudinary.com.evil.test/cv51-demo/image/upload/p.png',
        'https://res.cloudinary.com/other-cloud/image/upload/p.png',
        'https://res.cloudinary.com/cv51-demo/video/upload/p.png',
        'https://res.cloudinary.com/cv51-demo/image/upload/../../../other-cloud/image/upload/p.png',
        'https://res.cloudinary.com/cv51-demo/image/upload/%2e%2e/%2e%2e/%2e%2e/other-cloud/image/upload/p.png',
        'https://res.cloudinary.com/cv51-demo/image/upload/..\\..\\..\\other-cloud/image/upload/p.png',
        'blob:local-preview', 'data:image/png;base64,AAAA', 'C:\\users\\image.jpg', 'not-a-url',
    ]) {
        assert.equal(isCloudinaryImageUrl(value, cloudName), false, `URL chưa được chặn: ${value}`)
    }
})

 test('CV51-07: URL ví dụ trong fixture CV55 không phải URL production', () => {
    assert.equal(isCloudinaryImageUrl(fakeImageMessage.image.url, cloudName), false)
    assert.match(fakeImageMessage.image.url, /images\.example\.com/)
})

 test('CV51-08: người và phòng có cùng tên vẫn có khóa khác nhau', () => {
    const name = 'cv51-phong-trung-ten'
    const peopleKey = createConversationKey({ kind: 'people', name })
    const roomKey = createConversationKey({ kind: 'room', name })
    assert.notEqual(peopleKey, roomKey)
    assert.deepEqual(JSON.parse(peopleKey), ['people', name])
    assert.deepEqual(JSON.parse(roomKey), ['room', name])
})

 test('CV51-09: ma trận quyền phòng cho CV57 đầy đủ và không chứa kết quả giả', () => {
    const cases = JSON.parse(readFileSync(join(fixtureDir, 'room-rights-cases.json'), 'utf8'))
    const ids = new Set()
    for (const item of cases) {
        assert.match(item.id, /^R\d{2}$/)
        assert.ok(!ids.has(item.id), `Trùng mã ${item.id}`)
        ids.add(item.id)
        assert.ok(['allow','block','pin-target','retain-draft'].includes(item.expected))
        assert.ok(item.note)
        assert.equal(Object.hasOwn(item, 'actual'), false) // chỉ là test plan, chưa thử thật
    }
    assert.equal(cases.length, 12)
    for (const name of ['R03','R04','R05','R06','R08','R10']) {
        assert.equal(cases.find(c => c.id === name)?.expected, 'block')
    }
})
