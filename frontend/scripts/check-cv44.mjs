import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/roomsApi.ts', import.meta.url), 'utf8')
let requests = []
let respond = async () => ({})

class SocketRequestError extends Error {
    constructor(kind, wasSent) {
        super(kind)
        this.kind = kind
        this.wasSent = wasSent
    }
}

const socketClient = {
    request: async (event, data) => {
        requests.push({ event, data })
        return respond(event, data)
    },
}

const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
runInNewContext(output, {
    module,
    exports: module.exports,
    require: name => {
        assert.equal(name, './socketClient')
        return { socketClient, SocketRequestError }
    },
})
const { createRoom, joinRoom, loadRoom } = module.exports
let total = 0

async function check(label, test) {
    requests = []
    await test()
    total++
    console.log(`PASS CV44-${String(total).padStart(2, '0')} ${label}`)
}

await check('Tên phòng rỗng không gửi WebSocket', async () => {
    const result = await createRoom('   ')
    assert.equal(result.status, 'error')
    assert.equal(result.error.kind, 'business')
    assert.equal(requests.length, 0)
})

await check('Tên chính xác và event CREATE_ROOM', async () => {
    respond = async () => ({ event: 'CREATE_ROOM', status: 'success', data: { name: 'Phong_Hoc' } })
    const result = await createRoom(' Phong_Hoc ')
    assert.equal(result.status, 'success')
    assert.equal(JSON.stringify(requests), JSON.stringify([{ event: 'CREATE_ROOM', data: { name: 'Phong_Hoc' } }]))
    assert.equal(result.data.membership, 'owner')
})

await check('Event JOIN_ROOM và quyền thành viên sau success', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'success', data: { name: 'Room_2' } })
    const result = await joinRoom('Room_2')
    assert.equal(JSON.stringify(requests), JSON.stringify([{ event: 'JOIN_ROOM', data: { name: 'Room_2' } }]))
    assert.equal(result.status, 'success')
    assert.equal(result.data.membership, 'member')
    assert.equal(result.data.ownerKnown, false)
    assert.equal(result.data.membersKnown, false)
})

await check('Metadata own/userList đủ: chủ và thành viên', async () => {
    respond = async () => ({ event: 'CREATE_ROOM', status: 'success', data: {
        name: 'hoc_nhom', own: 'Khoi', userList: [{ name: 'Khoi' }, { name: 'Kiet' }],
    } })
    const result = await createRoom('hoc_nhom')
    assert.equal(result.status, 'success')
    assert.equal(result.data.owner, 'Khoi')
    assert.equal(result.data.ownerKnown, true)
    assert.equal(result.data.membersKnown, true)
    assert.deepEqual(Array.from(result.data.members), ['Khoi', 'Kiet'])
})

await check('Danh sách thành viên trống được xác nhận khác trường thiếu', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'success', data: { name: 'phong', userList: [] } })
    const result = await joinRoom('phong')
    assert.equal(result.status, 'success')
    assert.equal(result.data.membersKnown, true)
    assert.equal(result.data.members.length, 0)
})

await check('Danh sách thành viên chứa chuỗi cũng hợp lệ', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'success', data: { name: 'phong', userList: ['Khoi', 'Kiet', 'Khoi'] } })
    const result = await joinRoom('phong')
    assert.deepEqual(Array.from(result.data.members), ['Khoi', 'Kiet'])
})

await check('Danh sách thành viên không thể parse thì không giả rỗng', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'success', data: { name: 'phong', userList: [{ id: 1 }] } })
    const result = await joinRoom('phong')
    assert.equal(result.status, 'success')
    assert.equal(result.data.membersKnown, false)
    assert.equal('members' in result.data, false)
})

await check('Thành công nhưng tên phòng khác: unknown', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'success', data: { name: 'phong_khac' } })
    const result = await joinRoom('phong')
    assert.equal(result.status, 'unknown')
    assert.equal(result.error.kind, 'parse')
})

await check('Thành công nhưng thiếu tên phòng: unknown', async () => {
    respond = async () => ({ event: 'CREATE_ROOM', status: 'success', data: { own: 'Khoi' } })
    assert.equal((await createRoom('phong')).status, 'unknown')
})

await check('Phản hồi khác event không mở phòng', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'success', data: { name: 'phong' } })
    assert.equal((await createRoom('phong')).status, 'unknown')
})

await check('Lỗi trùng phòng lấy mes cấp ngoài', async () => {
    respond = async () => ({ event: 'CREATE_ROOM', status: 'error', mes: 'Room already exists!' })
    const result = await createRoom('phong')
    assert.equal(result.status, 'error')
    assert.equal(result.error.kind, 'business')
    assert.equal(result.error.message, 'Room already exists!')
})

await check('Lỗi không có phòng lấy data dạng chuỗi', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'error', data: 'Room not found' })
    const result = await joinRoom('phong')
    assert.equal(result.status, 'error')
    assert.equal(result.error.message, 'Room not found')
})

await check('Lỗi nghiệp vụ lấy data.mes', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'error', data: { mes: 'Not permitted' } })
    assert.equal((await joinRoom('phong')).error.message, 'Not permitted')
})

await check('Máy chủ báo lỗi không có mes vẫn giữ phân loại business', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'error' })
    assert.equal((await joinRoom('phong')).error.kind, 'business')
})

await check('Thiếu status không được coi thành công', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', data: { name: 'phong' } })
    assert.equal((await joinRoom('phong')).status, 'unknown')
})

await check('Status success nhưng data sai kiểu: unknown', async () => {
    respond = async () => ({ event: 'JOIN_ROOM', status: 'success', data: 'ok' })
    assert.equal((await joinRoom('phong')).status, 'unknown')
})

await check('Timeout sau khi gửi không được gửi lại tự động', async () => {
    respond = async () => { throw new SocketRequestError('timeout', true) }
    const result = await createRoom('phong')
    assert.equal(result.status, 'unknown')
    assert.equal(result.error.kind, 'timeout')
    assert.equal(requests.length, 1)
})

await check('Mất kết nối sau khi gửi: unknown', async () => {
    respond = async () => { throw new SocketRequestError('connection', true) }
    const result = await joinRoom('phong')
    assert.equal(result.status, 'unknown')
    assert.equal(result.error.kind, 'connection')
})

await check('Mất kết nối trước khi gửi: error', async () => {
    respond = async () => { throw new SocketRequestError('connection', false) }
    const result = await createRoom('phong')
    assert.equal(result.status, 'error')
    assert.equal(result.error.kind, 'connection')
})

await check('Lỗi ngoài dự kiến không ghi đã thành công', async () => {
    respond = async () => { throw new Error('Network down') }
    const result = await joinRoom('phong')
    assert.equal(result.status, 'error')
})

await check('CV45 loadRoom vẫn giữ stub, không thay đổi nghiệp vụ', async () => {
    assert.equal((await loadRoom('', 1)).error.kind, 'business')
    assert.equal((await loadRoom('phong', 0)).error.kind, 'business')
    assert.equal((await loadRoom('phong', 1)).status, 'error')
    assert.equal(requests.length, 0)
})

await check('Sidebar đã gắn cả hai form thật', async () => {
    const code = readFileSync(new URL('../src/components/ConversationSidebar.tsx', import.meta.url), 'utf8')
    assert.match(code, /<CreateRoom/)
    assert.match(code, /<JoinRoom/)
    assert.match(code, /onCreated=\{onRoomConfirmed\}/)
    assert.match(code, /onJoined=\{onRoomConfirmed\}/)
})

await check('Sidebar truyền service thật vào hai form CV40', async () => {
    const sidebar = readFileSync(new URL('../src/components/ConversationSidebar.tsx', import.meta.url), 'utf8')
    assert.match(sidebar, /createRoom=\{createRoomApi\}/)
    assert.match(sidebar, /joinRoom=\{joinRoomApi\}/)
})

console.log(`CV44: ${total}/${total} kiểm tra giả lập đạt`)
