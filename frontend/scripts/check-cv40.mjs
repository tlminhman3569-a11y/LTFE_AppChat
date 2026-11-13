import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mockCreateRoom, mockJoinRoom } from '../src/features/rooms/roomMockServices.ts'
import {
    clearRoomRequest as clearRequestForSession,
    getRoomRequest as getRequestForSession,
    sendRoomRequest as sendRequestForSession,
    subscribeRoomRequests,
} from '../src/features/rooms/roomRequestState.ts'

const source = name => readFileSync(fileURLToPath(new URL(`../src/features/rooms/${name}.tsx`, import.meta.url)), 'utf8')
assert.equal(existsSync(new URL('../src/features/rooms/CreateRoom.tsx', import.meta.url)), true, 'Thiếu file CreateRoom.tsx đúng tên')
assert.equal(existsSync(new URL('../src/features/rooms/CreateRomm.tsx', import.meta.url)), false, 'Vẫn còn file CreateRomm.tsx sai tên. Chỉ xóa CreateRomm.tsx, giữ CreateRoom.tsx')
let currentSessionGeneration = 1

function getRoomRequest(action, name) {
    return getRequestForSession(action, name, currentSessionGeneration)
}

function clearRoomRequest(action, name) {
    clearRequestForSession(action, name, currentSessionGeneration)
}

function sendRoomRequest(action, name, send, onChange) {
    return sendRequestForSession(action, name, currentSessionGeneration, () => currentSessionGeneration, send, onChange)
}

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
        ['đang gửi chặn nút submit và cho biết pending khi đóng', [/const latest = getRoomRequest/, /onClose\(\{ name: latest\.name, sessionGeneration: latest\.sessionGeneration, status: latest\.status \}\)/, /disabled=\{locked\}/]],
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
    assert.match(code, new RegExp(`getRoomRequest\\('${action}', name\\.trim\\(\\), sessionGeneration\\)`))
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
console.log(`${count}/${count} checks CV40 truoc day passed`)

for (const action of ['create', 'join']) {
    await check(`${action}: A gửi, đăng xuất, B đăng nhập, A trả về rồi B vẫn gửi được`, async () => {
        const name = `cv40_switch_${action}`
        const a = 100
        const b = 102
        let current = a
        const wait = deferred()
        const updatesA = []
        const startedA = sendRequestForSession(action, name, a, () => current, () => wait.promise, info => updatesA.push(info.status))
        assert.equal(getRequestForSession(action, name, a)?.status, 'pending')

        current = 101
        current = b
        wait.resolve(success(name))
        assert.equal(await startedA, null)
        assert.equal(getRequestForSession(action, name, a), null)
        assert.equal(getRequestForSession(action, name, b), null)
        assert.deepEqual(updatesA, ['pending'])

        let sentB = 0
        const resultB = await sendRequestForSession(action, name, b, () => current, async () => {
            sentB++
            return success(name)
        })
        assert.equal(resultB?.status, 'success')
        assert.equal(sentB, 1)
        assert.equal(getRequestForSession(action, name, b)?.status, 'success')
        clearRequestForSession(action, name, b)
    })

    await check(`${action}: phản hồi cũ sau khi xóa state không tạo lại success`, async () => {
        const name = `cv40_cleared_${action}`
        let current = 200
        const wait = deferred()
        const updates = []
        const started = sendRequestForSession(action, name, current, () => current, () => wait.promise, info => updates.push(info.status))
        assert.equal(getRequestForSession(action, name, current)?.status, 'pending')
        clearRequestForSession(action, name, current)
        wait.resolve(success(name))
        assert.equal(await started, null)
        assert.equal(getRequestForSession(action, name, current), null)
        assert.deepEqual(updates, ['pending'])
    })

    await check(`${action}: phản hồi A không ghi đè yêu cầu B đang chờ`, async () => {
        const name = `cv40_concurrent_${action}`
        const a = 300
        const b = 302
        let current = a
        const waitA = deferred()
        const waitB = deferred()
        const startedA = sendRequestForSession(action, name, a, () => current, () => waitA.promise)
        assert.equal(getRequestForSession(action, name, a)?.status, 'pending')
        current = b
        const startedB = sendRequestForSession(action, name, b, () => current, () => waitB.promise)
        assert.equal(getRequestForSession(action, name, b)?.status, 'pending')
        waitA.resolve(success(name))
        assert.equal(await startedA, null)
        assert.equal(getRequestForSession(action, name, b)?.status, 'pending')
        waitB.resolve(success(name))
        assert.equal((await startedB)?.status, 'success')
        assert.equal(getRequestForSession(action, name, b)?.status, 'success')
        clearRequestForSession(action, name, b)
    })

    await check(`${action}: unknown của A không khóa cùng tên ở phiên B`, async () => {
        const name = `cv40_unknown_new_session_${action}`
        const a = 400
        const b = 402
        let current = a
        const resultA = await sendRequestForSession(action, name, a, () => current, async () => ({
            status: 'unknown', error: { kind: 'timeout', message: 'chua ro' },
        }))
        assert.equal(resultA?.status, 'unknown')
        assert.equal(getRequestForSession(action, name, a)?.status, 'unknown')
        current = b
        assert.equal(getRequestForSession(action, name, b), null)
        const resultB = await sendRequestForSession(action, name, b, () => current, async () => success(name))
        assert.equal(resultB?.status, 'success')
        clearRequestForSession(action, name, a)
        clearRequestForSession(action, name, b)
    })

    await check(`${action}: không cho phiên cũ bắt đầu yêu cầu mới`, async () => {
        const name = `cv40_stale_start_${action}`
        let current = 502
        let sent = 0
        const result = await sendRequestForSession(action, name, 500, () => current, async () => {
            sent++
            return success(name)
        })
        assert.equal(result, null)
        assert.equal(sent, 0)
        assert.equal(getRequestForSession(action, name, 500), null)
    })
}

for (const [action, component] of [['create', 'CreateRoom'], ['join', 'JoinRoom']]) {
    await check(`${action}: form đọc phiên thật và truyền sessionGeneration vào request`, async () => {
        const code = source(component)
        assert.match(code, /const sessionGeneration = useAppSelector\(state => state\.auth\.sessionGeneration\)/)
        assert.match(code, /\(\) => store\.getState\(\)\.auth\.sessionGeneration/)
        assert.match(code, new RegExp(`getRoomRequest\\('${action}', name\\.trim\\(\\), sessionGeneration\\)`))
        assert.match(code, /update => onRequestChange\?\.\(\{ name: update\.name, sessionGeneration: update\.sessionGeneration, status: update\.status \}\)/)
    })
}
console.log('12/12 checks phien dang nhap va form passed')
console.log(`${count}/${count} checks passed`)
