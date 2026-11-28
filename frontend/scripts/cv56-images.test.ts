import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { UploadedImage } from '../src/types/media'
import { parseImageMessage, serializeImageMessage } from '../src/utils/imageMessage'
import { useImageDrafts } from '../src/features/upload/useImageDrafts'

const mocks = vi.hoisted(() => ({
    refs: [] as { current: unknown }[], cursor: 0, state: undefined as unknown,
    cleanup: undefined as undefined | (() => void),
    auth: { authStatus: 'authenticated', connectionStatus: 'connected', sessionGeneration: 1 },
    rooms: {} as Record<string, unknown>,
    upload: vi.fn(), send: vi.fn(), leave: vi.fn(),
}))
vi.mock('react', () => ({
    useRef: (value: unknown) => mocks.refs[mocks.cursor++] ?? (mocks.refs[mocks.cursor - 1] = { current: value }),
    useState: (value: unknown) => {
        mocks.state ??= value
        return [mocks.state, (next: unknown) => { mocks.state = next }]
    },
    useEffect: (effect: () => () => void) => { mocks.cleanup ??= effect() },
}))
vi.mock('../src/store', () => ({ store: { getState: () => ({ auth: mocks.auth, rooms: { byKey: mocks.rooms } }) } }))
vi.mock('../src/services/uploadApi', () => ({ uploadImage: mocks.upload }))
vi.mock('../src/services/chatApi', () => ({ sendText: mocks.send }))
vi.mock('../src/features/rooms/leaveRoomRequestState', () => ({ getLeaveRequest: mocks.leave }))

const people = { kind: 'people', name: 'peer' } as const
const room = { kind: 'room', name: 'peer' } as const
const image: UploadedImage = { url: 'https://res.cloudinary.com/demo/image/upload/v1/anh.png',
    publicId: 'ảnh/thử', mimeType: 'image/png', bytes: 120, width: 8, height: 8 }
const content = { version: 1, type: 'image', clientMessageId: 'a'.repeat(32), image } as const
const file = new File(['image'], 'anh.png', { type: 'image/png' })

function DraftHarness() {
    // Con trỏ giả lập hook cho test callback, không phải state của component.
    // eslint-disable-next-line react-hooks/immutability
    mocks.cursor = 0
    return useImageDrafts(1)
}

beforeEach(() => {
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'demo')
    mocks.refs = []; mocks.cursor = 0; mocks.state = undefined; mocks.cleanup = undefined
    mocks.auth = { authStatus: 'authenticated', connectionStatus: 'connected', sessionGeneration: 1 }
    mocks.rooms = {}; mocks.leave.mockReset(); mocks.send.mockReset()
    mocks.upload.mockReset().mockResolvedValue({ status: 'success', data: image })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { mocks.cleanup?.(); vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('CV56 — mã hóa tin ảnh theo hợp đồng CV55', () => {
    it('round trip đúng schema, escape Unicode và giữ clientMessageId', () => {
        const encoded = serializeImageMessage(content)
        expect(encoded.status).toBe('success')
        if (encoded.status !== 'success') return
        expect([...encoded.data].every(unit => unit.charCodeAt(0) < 128)).toBe(true)
        expect(parseImageMessage(encoded.data)).toEqual(content)
    })
    it('từ chối URL ngoài cloud, schema lỗi, metadata sai và tin quá byte', () => {
        for (const patch of [{ url: 'javascript:alert(1)' }, { url: 'https://res.cloudinary.com/other/image/upload/a.png' },
            { width: 0 }, { bytes: 6 * 1024 * 1024 }, { mimeType: 'image/svg+xml' }]) {
            const candidate = { ...content, image: { ...image, ...patch } }
            expect(parseImageMessage('APPCHAT_IMAGE_V1' + JSON.stringify(candidate))).toBeNull()
        }
        expect(parseImageMessage('APPCHAT_IMAGE_V1{')).toBeNull()
        expect(parseImageMessage('APPCHAT_IMAGE_V1' + JSON.stringify({ ...content, version: 2 }))).toBeNull()
        expect(serializeImageMessage({ ...content, image: { ...image, publicId: 'a'.repeat(1900) } }).status).toBe('error')
    })
})

describe('CV56 — chọn ảnh và upload đúng tác vụ (hook, không phải UI thật)', () => {
    it('giữ ảnh riêng cho người/phòng cùng tên; bỏ ảnh thu hồi preview', () => {
        DraftHarness().select(people, file)
        expect(DraftHarness().get(people)?.file).toBe(file)
        expect(DraftHarness().get(room)).toBeUndefined()
        DraftHarness().remove(people)
        expect(DraftHarness().get(people)?.file).toBeUndefined()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
        expect(mocks.upload).not.toHaveBeenCalled()
    })
    it('chặn file sai, rỗng, quá lớn và offline trước upload', async () => {
        for (const invalid of [new File(['x'], 'x.svg', { type: 'image/svg+xml' }),
            new File([], 'x.png', { type: 'image/png' }),
            new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'x.png', { type: 'image/png' })]) {
            DraftHarness().select(people, invalid)
            expect(DraftHarness().get(people)?.error).toBeTruthy()
        }
        mocks.auth.connectionStatus = 'disconnected'
        DraftHarness().select(people, file)
        await DraftHarness().send(people)
        expect(mocks.upload).not.toHaveBeenCalled()
        expect(mocks.send).not.toHaveBeenCalled()
    })
    it('chụp đích từ đầu, chặn double click và chỉ gửi URL một lần', async () => {
        let finish!: (result: unknown) => void
        mocks.upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
        DraftHarness().select(people, file)
        const sending = DraftHarness().send(people)
        await DraftHarness().send(people)
        DraftHarness().select({ kind: 'people', name: 'other' }, file)
        finish({ status: 'success', data: image })
        await sending
        expect(mocks.upload).toHaveBeenCalledTimes(1)
        expect(mocks.send).toHaveBeenCalledExactlyOnceWith(people, expect.stringContaining('APPCHAT_IMAGE_V1'))
        expect(parseImageMessage(mocks.send.mock.calls[0][1])?.image).toEqual(image)
        expect(DraftHarness().get(people)?.file).toBeUndefined()
        expect(DraftHarness().get({ kind: 'people', name: 'other' })?.file).toBe(file)
    })
    it.each(['bỏ ảnh', 'đổi phiên', 'mất mạng', 'tháo component'])('không gửi phản hồi trễ sau %s', async action => {
        let finish!: (result: unknown) => void
        mocks.upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
        DraftHarness().select(people, file)
        const sending = DraftHarness().send(people)
        if (action === 'bỏ ảnh') DraftHarness().remove(people)
        if (action === 'đổi phiên') mocks.auth.sessionGeneration = 2
        if (action === 'mất mạng') mocks.auth.connectionStatus = 'disconnected'
        if (action === 'tháo component') mocks.cleanup?.()
        finish({ status: 'success', data: image })
        await sending
        expect(mocks.send).not.toHaveBeenCalled()
    })
    it('kiểm tra lại quyền phòng sau upload; giữ ảnh khi lỗi', async () => {
        // ConversationKey dùng JSON của loại và tên như code sản phẩm.
        const { createConversationKey } = await import('../src/utils/conversationKey')
        mocks.rooms[createConversationKey(room)] = { room: { membership: 'member' } }
        DraftHarness().select(room, file)
        mocks.upload.mockImplementation(async () => {
            mocks.leave.mockReturnValue({ status: 'unknown' })
            return { status: 'success', data: image }
        })
        await DraftHarness().send(room)
        expect(mocks.send).not.toHaveBeenCalled()
        expect(DraftHarness().get(room)?.file).toBe(file)
        expect(DraftHarness().get(room)?.error).toBeTruthy()
    })
    it('upload lỗi giữ nháp, không gửi và không tự upload lại', async () => {
        mocks.upload.mockResolvedValue({ status: 'error', error: { kind: 'network', message: 'Lỗi mạng' } })
        DraftHarness().select(people, file)
        await DraftHarness().send(people)
        expect(DraftHarness().get(people)?.file).toBe(file)
        expect(DraftHarness().get(people)?.error).toBe('Lỗi mạng')
        expect(mocks.upload).toHaveBeenCalledTimes(1)
        expect(mocks.send).not.toHaveBeenCalled()
    })
    it('thay ảnh hoặc xác nhận logout hủy tác vụ cũ, không gửi kết quả trễ', async () => {
        for (const action of ['replace', 'logout']) {
            let finish!: (result: unknown) => void
            mocks.upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
            DraftHarness().select(people, file)
            const sending = DraftHarness().send(people)
            const signal = mocks.upload.mock.calls.at(-1)![1] as AbortSignal
            if (action === 'replace') DraftHarness().select(people, new File(['new'], 'new.png', { type: 'image/png' }))
            else DraftHarness().cancelUploads()
            expect(signal.aborted).toBe(true)
            finish({ status: 'success', data: image })
            await sending
            expect(mocks.send).not.toHaveBeenCalled()
            expect(DraftHarness().get(people)?.file).toBeDefined()
        }
    })
    it('send ném lỗi giữ ảnh đã upload và ID gốc khi người dùng bấm lại', async () => {
        mocks.send.mockImplementationOnce(() => { throw new Error('socket closed') })
        DraftHarness().select(people, file)
        const originalId = DraftHarness().get(people)?.clientMessageId
        await DraftHarness().send(people)
        expect(DraftHarness().get(people)?.file).toBe(file)
        expect(DraftHarness().get(people)?.error).toBeTruthy()
        await DraftHarness().send(people)
        expect(mocks.upload).toHaveBeenCalledTimes(1)
        expect(parseImageMessage(mocks.send.mock.calls[1][1])?.clientMessageId).toBe(originalId)
    })
})
