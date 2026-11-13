import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mockCreateRoom, mockJoinRoom } from '../src/features/rooms/roomMockServices.ts'
import { clearRoomRequest, getRoomRequest, sendRoomRequest, subscribeRoomRequests } from '../src/features/rooms/roomRequestState.ts'

const source = name => readFileSync(fileURLToPath(new URL(`../src/features/rooms/${name}.tsx`, import.meta.url)), 'utf8')
assert.equal(existsSync(new URL('../src/features/rooms/CreateRoom.tsx', import.meta.url)), true, 'Thiếu file CreateRoom.tsx đúng tên')
assert.equal(existsSync(new URL('../src/features/rooms/CreateRomm.tsx', import.meta.url)), false, 'Vẫn còn file CreateRomm.tsx sai tên. Chỉ xóa CreateRomm.tsx, giữ CreateRoom.tsx')
let count = 0
async function check(label, test) {
    await test()
    count++
    console.log(`PASS ${label}`)
}

for (const [label, component, action] of [['Tạo', 'CreateRoom', 'create'], ['Tham gia', 'JoinRoom', 'join']]) {
    const code = source(component)
    const mockExport = new RegExp(`export (async )?function mock`)
    const patterns = [
        ['chỉ gõ tên không gửi lệnh ghi', [/onChange=\{event => \{\s*setName\(event\.target\.value\)/, /async function submit\(/]],
        ['tên trống báo lỗi, không gửi', [/if \(!roomName\) \{\s*setInputError\('Vui lòng nhập tên phòng\.'\)\s*return/]],
        ['hủy trước gửi không gọi API', [/function close\(/, /else \{\s*onClose\(\)/]],
        ['đang gửi chặn nút submit và cho biết pending khi đóng', [/const latest = getRoomRequest/, /onClose\(\{ name: latest\.name, status: latest\.status \}\)/, /disabled=\{locked\}/]],
        ['lỗi server giữ tên và cho phép sửa', [/const \[name, setName\] = useState\(initialName\)/, /const locked = status === 'pending' \|\| status === 'unknown' \|\| status === 'success'/]],
        ['timeout giữ unknown và không tự gửi lại', [/useSyncExternalStore/, /status === 'unknown'/]],
        ['request ném lỗi không coi là thất bại chắc chắn', [/sendRoomRequest/, /roomRequestState/]],
        ['thành công chỉ gọi callback sau submit', [/if \(result\?\.status === 'success' && isOpen\.current\)/, /onSelectConversation\?\.\(\{ kind: 'room', name: result\.data\.name \}\)/]],
        ['popup co giãn cho desktop/mobile', [/width: 'min\(100%, 560px\)'/, /padding: 'clamp\(20px, 5vw, 32px\)'/]],
    ]
    for (const [labelPart, regexes] of patterns) {
        await check(`${label}: ${labelPart}`, () => {
            for (const pattern of regexes) assert.match(code, pattern)
            assert.doesNotMatch(code, mockExport)
        })
    }
    assert.match(code, new RegExp(`getRoomRequest\\('${action}', name\\.trim\\(\\)\\)`))
}

const mockChecks = [
    ['Tạo: mock báo trùng tên có trong fixture CV38', () => mockCreateRoom('nhom_hoc'), r => { assert.equal(r.status, 'error'); assert.match(r.error.message, /đã tồn tại/) }],
    ['Tạo: mock thành công trả membership chủ phòng', () => mockCreateRoom('cv40_room_new'), r => { assert.equal(r.status, 'success'); assert.equal(r.data.membership, 'owner') }],
    ['Tạo: mock lỗi nghiệp vụ', () => mockCreateRoom('cv40_error', 'error'), r => assert.equal(r.status, 'error')],
    ['Tạo: mock timeout chưa xác định', () => mockCreateRoom('cv40_timeout', 'unknown'), r => { assert.equal(r.status, 'unknown'); assert.equal(r.error.kind, 'timeout') }],
    ['Tham gia: mock phòng có trong fixture', () => mockJoinRoom('nhom_hoc'), r => { assert.equal(r.status, 'success'); assert.equal(r.data.membership, 'member') }],
    ['Tham gia: phòng không có trong fixture không tự tạo', () => mockJoinRoom('cv40_room_missing'), r => { assert.equal(r.status, 'error'); assert.match(r.error.message, /không chứng minh/) }],
    ['Tham gia: mock lỗi nghiệp vụ', () => mockJoinRoom('nhom_hoc', 'error'), r => assert.equal(r.status, 'error')],
    ['Tham gia: mock timeout chưa xác định', () => mockJoinRoom('nhom_hoc', 'unknown'), r => { assert.equal(r.status, 'unknown'); assert.equal(r.error.kind, 'timeout') }],
]
for (const [label, send, verify] of mockChecks) await check(label, async () => verify(await send()))
console.log(`${count}/26 checks goc passed`)

function deferred() {
    let resolve
    const promise = new Promise(done => { resolve = done })
    return { promise, resolve }
}
function success(name) {
    return { status: 'success', data: { name, ownerKnown: false, membersKnown: false, membership: 'member' } }
}
for (const action of ['create', 'join']) {
    await check(`${action}: đóng khi pending và mở lại vẫn chặn gửi trùng`, async () => {
        const name = `cv40_pending_${action}`
        clearRoomRequest(action, name)
        const wait = deferred()
        let sent = 0
        const first = sendRoomRequest(action, name, () => { sent++; return wait.promise })
        assert.equal(getRoomRequest(action, name)?.status, 'pending')
        assert.equal(await sendRoomRequest(action, name, async () => { sent++; return success(name) }), null)
        assert.equal(sent, 1)
        wait.resolve(success(name))
        await first
        assert.equal(getRoomRequest(action, name)?.status, 'success')
        clearRoomRequest(action, name)
    })
    await check(`${action}: timeout unknown và mở lại vẫn chặn gửi trùng`, async () => {
        const name = `cv40_unknown_${action}`
        clearRoomRequest(action, name)
        let sent = 0
        await sendRoomRequest(action, name, async () => { sent++; return { status: 'unknown', error: { kind: 'timeout', message: 'Timeout' } } })
        assert.equal(getRoomRequest(action, name)?.status, 'unknown')
        assert.equal(await sendRoomRequest(action, name, async () => { sent++; return success(name) }), null)
        assert.equal(sent, 1)
        clearRoomRequest(action, name)
    })
}
await check('Lỗi kết nối sau gửi không tự cho phép gửi lại', async () => {
    const name = 'cv40_connection'
    clearRoomRequest('create', name)
    const r = await sendRoomRequest('create', name, async () => { throw new Error('lost') })
    assert.equal(r.status, 'unknown')
    assert.equal(getRoomRequest('create', name)?.status, 'unknown')
    assert.equal(await sendRoomRequest('create', name, async () => success(name)), null)
    clearRoomRequest('create', name)
})
await check('Lỗi nghiệp vụ cho phép sửa và gửi lại', async () => {
    const name = 'cv40_business'
    clearRoomRequest('join', name)
    await sendRoomRequest('join', name, async () => ({ status: 'error', error: { kind: 'business', message: 'No' } }))
    assert.equal(getRoomRequest('join', name)?.status, 'error')
    const r = await sendRoomRequest('join', name, async () => success(name))
    assert.equal(r.status, 'success')
    clearRoomRequest('join', name)
})
await check('Tạo và tham gia cùng tên lưu độc lập', async () => {
    const name = 'cv40_same'
    clearRoomRequest('join', name)
    clearRoomRequest('create', name)
    const wait = deferred()
    const create = sendRoomRequest('create', name, () => wait.promise)
    await sendRoomRequest('join', name, async () => success(name))
    assert.equal(getRoomRequest('create', name)?.status, 'pending')
    assert.equal(getRoomRequest('join', name)?.status, 'success')
    wait.resolve(success(name))
    await create
    clearRoomRequest('create', name)
    clearRoomRequest('join', name)
})
await check('Callback sau đóng vẫn nhận pending rồi unknown', async () => {
    const name = 'cv40_callback'
    clearRoomRequest('join', name)
    const wait = deferred()
    const status = []
    const started = sendRoomRequest('join', name, () => wait.promise, info => status.push(info.status))
    assert.deepEqual(status, ['pending'])
    wait.resolve({ status: 'unknown', error: { kind: 'timeout', message: 'chua ro' } })
    await started
    assert.deepEqual(status, ['pending', 'unknown'])
    clearRoomRequest('join', name)
})
await check('Form mở lại nhận cập nhật từ bộ nhớ yêu cầu', async () => {
    const name = 'cv40_subscriber'
    clearRoomRequest('create', name)
    let calls = 0
    const unsubscribe = subscribeRoomRequests(() => calls++)
    const wait = deferred()
    const started = sendRoomRequest('create', name, () => wait.promise)
    wait.resolve(success(name))
    await started
    assert(calls >= 2)
    assert.equal(getRoomRequest('create', name)?.status, 'success')
    unsubscribe()
    clearRoomRequest('create', name)
})
console.log(`${count - 26}/9 checks bo sung passed`)
console.log(`${count}/${count} checks passed`)
