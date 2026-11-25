import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const base = new URL('../src/', import.meta.url)
let calls = []
let reply = async () => ({})
class SocketRequestError extends Error {
    constructor(kind, wasSent) { super(kind); this.kind = kind; this.wasSent = wasSent }
}
const socketClient = {
    request: async (event, data) => {
        calls.push({ event, data })
        return reply(event, data)
    },
}
function load(path, deps = {}) {
    const source = readFileSync(new URL(path, base), 'utf8')
    const js = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText
    const module = { exports: {} }
    runInNewContext(js, { module, exports: module.exports, console,
        require: name => {
            assert.ok(Object.hasOwn(deps, name), `Unexpected module: ${name}`)
            return deps[name]
        },
    })
    return module.exports
}
const roomsApi = load('services/roomsApi.ts', { './socketClient': { socketClient, SocketRequestError } })
const usersApi = load('services/usersApi.ts', {
    './socketClient': { socketClient, SocketRequestError },
    '../utils/normalizeRecentConversations': { parseGetUserListResponse: result => result },
})
const requestState = load('features/rooms/roomRequestState.ts')
const leaveState = load('features/rooms/leaveRoomRequestState.ts')

let passed = 0
let failed = 0
const failures = []
async function test(label, action) {
    calls = []
    try {
        await action()
        passed++
        console.log(`PASS CV49-${String(passed).padStart(2, '0')} ${label}`)
    } catch (error) {
        failed++
        failures.push({ label, reason: String(error?.message ?? error).slice(0, 250) })
        console.error(`FAIL CV49 ${label}: ${String(error?.message ?? error).slice(0, 250)}`)
    }
}
const room = (name, membership = 'member') => ({ name, membership, ownerKnown: false, membersKnown: false })
const success = (event, name, extra = {}) => ({ event, status: 'success', data: { name, ...extra } })
const businessError = event => ({ event, status: 'error', mes: 'Không thể hoàn tất thao tác' })

await test('F13 - tên phòng rỗng không tạo request', async () => {
    assert.equal((await roomsApi.createRoom('  ')).status, 'error')
    assert.equal(calls.length, 0)
})
await test('F13 - CREATE_ROOM chỉ xác nhận tên chính xác', async () => {
    reply = async () => success('CREATE_ROOM', 'Lop_CV49', { own: 'A' })
    const result = await roomsApi.createRoom(' Lop_CV49 ')
    assert.equal(result.status, 'success')
    assert.equal(result.data.membership, 'owner')
    assert.equal(calls.length, 1)
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { event: 'CREATE_ROOM', data: { name: 'Lop_CV49' } })
})
await test('F13 - tên trùng báo lỗi nghiệp vụ, không thành công giả', async () => {
    reply = async () => businessError('CREATE_ROOM')
    const result = await roomsApi.createRoom('Lop_CV49')
    assert.equal(result.status, 'error')
    assert.equal(result.error.kind, 'business')
})
await test('F13 - success sai tên là unknown', async () => {
    reply = async () => success('CREATE_ROOM', 'Phong_Khac')
    assert.equal((await roomsApi.createRoom('Lop_CV49')).status, 'unknown')
})
await test('F14 - JOIN_ROOM gửi đúng sự kiện và tên', async () => {
    reply = async () => success('JOIN_ROOM', 'Lop_CV49')
    const result = await roomsApi.joinRoom('Lop_CV49')
    assert.equal(result.status, 'success')
    assert.equal(result.data.membership, 'member')
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ event: 'JOIN_ROOM', data: { name: 'Lop_CV49' } }])
})
await test('F14 - không tồn tại/đã tham gia là lỗi nghiệp vụ khi server từ chối', async () => {
    reply = async () => businessError('JOIN_ROOM')
    assert.equal((await roomsApi.joinRoom('Phong_Khong_Ton_Tai')).error.kind, 'business')
    assert.equal((await roomsApi.joinRoom('Lop_CV49')).status, 'error')
})
await test('F14 - success sai event không được mở quyền', async () => {
    reply = async () => success('CREATE_ROOM', 'Lop_CV49')
    assert.equal((await roomsApi.joinRoom('Lop_CV49')).status, 'unknown')
})
await test('F14 - success thiếu tên không được mở quyền', async () => {
    reply = async () => ({ event: 'JOIN_ROOM', status: 'success', data: {} })
    assert.equal((await roomsApi.joinRoom('Lop_CV49')).status, 'unknown')
})
await test('F14 - request đã gửi timeout: unknown, không tự gửi lại', async () => {
    reply = async () => { throw new SocketRequestError('timeout', true) }
    const result = await roomsApi.joinRoom('Lop_CV49')
    assert.equal(result.status, 'unknown')
    assert.equal(result.error.kind, 'timeout')
    assert.equal(calls.length, 1)
})
await test('F14 - request chưa gửi thất bại không đổi thành unknown', async () => {
    reply = async () => { throw new SocketRequestError('connection', false) }
    assert.equal((await roomsApi.joinRoom('Lop_CV49')).status, 'error')
})
await test('F15 - đọc thành viên/chủ phòng với dữ liệu hợp lệ', async () => {
    reply = async () => success('GET_ROOM_CHAT_MES', 'Lop_CV49', {
        page: 1, own: 'A', userList: ['A', { name: 'B' }], chatData: [],
    })
    const result = await roomsApi.loadRoom('Lop_CV49', 1)
    assert.equal(result.status, 'success')
    assert.equal(result.data.owner, 'A')
    assert.equal(result.data.membersKnown, true)
    assert.deepEqual(Array.from(result.data.members), ['A', 'B'])
    assert.equal(result.data.membership, 'unknown')
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ event: 'GET_ROOM_CHAT_MES', data: { name: 'Lop_CV49', page: 1 } }])
})
await test('F15 - thiếu metadata không suy ra owner/member', async () => {
    reply = async () => success('GET_ROOM_CHAT_MES', 'Lop_CV49', { page: 1, chatData: [] })
    const result = await roomsApi.loadRoom('Lop_CV49', 1)
    assert.equal(result.status, 'success')
    assert.equal(result.data.ownerKnown, false)
    assert.equal(result.data.membersKnown, false)
    assert.equal('members' in result.data, false)
})
await test('F15 - danh sách rỗng được xác nhận khác trường thiếu', async () => {
    reply = async () => success('GET_ROOM_CHAT_MES', 'Lop_CV49', { chatData: [], userList: [] })
    const result = await roomsApi.loadRoom('Lop_CV49', 1)
    assert.equal(result.data.membersKnown, true)
    assert.equal(result.data.members.length, 0)
})
await test('F15 - member metadata hỏng không biến thành mảng rỗng', async () => {
    reply = async () => success('GET_ROOM_CHAT_MES', 'Lop_CV49', { chatData: [], userList: 23 })
    const result = await roomsApi.loadRoom('Lop_CV49', 1)
    assert.equal(result.status, 'error')
    assert.equal(result.error.kind, 'parse')
})
await test('F15 - response sai trang bị chặn', async () => {
    reply = async () => success('GET_ROOM_CHAT_MES', 'Lop_CV49', { page: 2, chatData: [] })
    assert.equal((await roomsApi.loadRoom('Lop_CV49', 1)).status, 'error')
})
await test('F15 - timeout tải danh sách không giả 0 thành viên', async () => {
    reply = async () => { throw new SocketRequestError('timeout', true) }
    const result = await roomsApi.loadRoom('Lop_CV49', 1)
    assert.equal(result.status, 'error')
    assert.equal(result.error.kind, 'timeout')
})
await test('F16 - OUT_ROOM có xác nhận hợp lệ', async () => {
    reply = async () => success('OUT_ROOM', 'Lop_CV49')
    const result = await roomsApi.leaveRoom('Lop_CV49')
    assert.equal(result.status, 'success')
    assert.equal(result.data.roomName, 'Lop_CV49')
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ event: 'OUT_ROOM', data: { name: 'Lop_CV49' } }])
})
await test('F16 - OUT_ROOM sai phòng vẫn unknown', async () => {
    reply = async () => success('OUT_ROOM', 'Phong_Khac')
    assert.equal((await roomsApi.leaveRoom('Lop_CV49')).status, 'unknown')
})
await test('F16 - OUT_ROOM bị từ chối giữ lỗi business', async () => {
    reply = async () => businessError('OUT_ROOM')
    assert.equal((await roomsApi.leaveRoom('Lop_CV49')).status, 'error')
})
await test('F16 - OUT_ROOM timeout sau gửi giữ unknown', async () => {
    reply = async () => { throw new SocketRequestError('timeout', true) }
    const result = await roomsApi.leaveRoom('Lop_CV49')
    assert.equal(result.status, 'unknown')
    assert.equal(calls.length, 1)
})
await test('F09 - username chính xác có và không tồn tại', async () => {
    reply = async (_event, data) => ({ event: 'CHECK_USER_EXIST', status: 'success', data: { status: data.user === 'B' } })
    assert.equal((await usersApi.checkExists('B')).data, true)
    assert.equal((await usersApi.checkExists('TenKhongCo')).data, false)
    assert.equal(calls.every(call => call.event === 'CHECK_USER_EXIST'), true)
})
await test('F09 - username không hợp lệ không gửi API', async () => {
    const result = await usersApi.checkExists('a b')
    assert.equal(result.status, 'error')
    assert.equal(calls.length, 0)
})
await test('F09 - lỗi kiểm tra không được hiểu thành không tồn tại', async () => {
    reply = async () => ({ event: 'CHECK_USER_EXIST', status: 'success', data: { status: 'false' } })
    const result = await usersApi.checkExists('B')
    assert.equal(result.status, 'error')
})
await test('F07 - GET_USER_LIST không có thao tác JOIN ngầm', async () => {
    reply = async () => ({ event: 'GET_USER_LIST', status: 'success', data: {} })
    await usersApi.getRecentConversations()
    assert.deepEqual(calls.map(call => call.event), ['GET_USER_LIST'])
})

await test('F14 - double click bị khóa khi yêu cầu đang chờ', async () => {
    requestState.clearRoomRequests()
    let resolveFirst
    let sends = 0
    const first = requestState.sendRoomRequest('join', 'Lop_CV49', 12, () => 12,
        () => { sends++; return new Promise(resolve => { resolveFirst = resolve }) })
    assert.equal(requestState.getRoomRequest('join', 'Lop_CV49', 12).status, 'pending')
    const second = await requestState.sendRoomRequest('join', 'Lop_CV49', 12, () => 12, () => { sends++; return Promise.resolve({ status: 'success', data: room('Lop_CV49') }) })
    assert.equal(second, null)
    assert.equal(sends, 1)
    resolveFirst({ status: 'success', data: room('Lop_CV49') })
    assert.equal((await first).status, 'success')
})
await test('F14 - success trả về sai tên không báo thành công ở UI (CV49 fix)', async () => {
    requestState.clearRoomRequests()
    const result = await requestState.sendRoomRequest('join', 'Lop_CV49', 12, () => 12,
        async () => ({ status: 'success', data: room('Phong_Khac') }))
    assert.equal(result.status, 'unknown')
    assert.equal(result.error.kind, 'parse')
    assert.equal(requestState.getRoomRequest('join', 'Lop_CV49', 12).status, 'unknown')
})
await test('F14 - unknown chặn tự JOIN lặp lại', async () => {
    let sends = 0
    const result = await requestState.sendRoomRequest('join', 'Lop_CV49', 12, () => 12,
        async () => { sends++; return { status: 'success', data: room('Lop_CV49') } })
    assert.equal(result, null)
    assert.equal(sends, 0)
})
await test('F14 - business error cho phép người dùng bấm thử lại', async () => {
    requestState.clearRoomRequests()
    const send = async () => ({ status: 'error', error: { kind: 'business', message: 'Không có quyền' } })
    assert.equal((await requestState.sendRoomRequest('join', 'Lop_CV49', 12, () => 12, send)).status, 'error')
    assert.equal((await requestState.sendRoomRequest('join', 'Lop_CV49', 12, () => 12, async () => ({ status: 'success', data: room('Lop_CV49') }))).status, 'success')
})
await test('F14 - response từ phiên cũ không được công bố thành công', async () => {
    requestState.clearRoomRequests()
    let generation = 12
    let resolveFirst
    const first = requestState.sendRoomRequest('join', 'Lop_CV49', 12, () => generation, () => new Promise(resolve => { resolveFirst = resolve }))
    generation = 13
    resolveFirst({ status: 'success', data: room('Lop_CV49') })
    assert.equal(await first, null)
    assert.equal(requestState.getRoomRequest('join', 'Lop_CV49', 12), null)
})
await test('F18 - phản hồi JOIN thành công mới xóa trạng thái rời', async () => {
    leaveState.clearLeaveRequests()
    leaveState.updateLeaveRequest(12, 'Lop_CV49', { status: 'success', message: 'Đã rời' })
    assert.equal(leaveState.getLeaveRequest(12, 'Lop_CV49').status, 'success')
    assert.equal(leaveState.resetLeaveAfterJoin(12, 'Lop_CV49'), true)
    assert.equal(leaveState.getLeaveRequest(12, 'Lop_CV49'), null)
})
await test('F18 - không xóa trạng thái đang rời pending', async () => {
    leaveState.updateLeaveRequest(12, 'Lop_CV49', { status: 'pending', message: 'Đang rời' })
    assert.equal(leaveState.resetLeaveAfterJoin(12, 'Lop_CV49'), false)
    assert.equal(leaveState.getLeaveRequest(12, 'Lop_CV49').status, 'pending')
})
console.log(`\nCV49 MOCK CONTRACT TESTS: ${passed} passed, ${failed} failed. No live server used.`)
if (failures.length) {
    console.error(JSON.stringify(failures, null, 2))
    process.exitCode = 1
}
