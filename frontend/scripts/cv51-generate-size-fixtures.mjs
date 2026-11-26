import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const root = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(root, 'cv51-fixtures', 'valid-png.png'))
const targetDir = join(root, 'cv51-fixtures', 'generated')
const limit = 5 * 1024 * 1024
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex')
if (!source.subarray(0, 8).equals(pngSignature)) throw new Error('Fixture gốc không phải PNG')

function crc32(buffer) {
    let crc = 0xffffffff
    for (const byte of buffer) {
        crc ^= byte
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
}

function writePngOfSize(size, filename) {
    const extraLength = size - source.length - 12
    if (extraLength < 0) throw new Error('Đích nhỏ hơn ảnh gốc')
    const typeAndPayload = Buffer.concat([Buffer.from('raNd'), randomBytes(extraLength)])
    const ancillaryChunk = Buffer.alloc(12 + extraLength)
    ancillaryChunk.writeUInt32BE(extraLength, 0)
    typeAndPayload.copy(ancillaryChunk, 4)
    ancillaryChunk.writeUInt32BE(crc32(typeAndPayload), 8 + extraLength)
    const trailingIend = source.subarray(source.length - 12)
    if (trailingIend.toString('ascii', 4, 8) !== 'IEND') throw new Error('Ảnh PNG thiếu IEND')
    const out = Buffer.concat([source.subarray(0, source.length - 12), ancillaryChunk, trailingIend])
    if (out.length !== size) throw new Error('Sai dung lượng fixture')
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(targetDir, filename), out)
    console.log(`${filename}: ${out.length} bytes`)
}

writePngOfSize(limit, 'valid-exactly-5MiB.png')
writePngOfSize(limit + 1, 'invalid-over-5MiB.png')
