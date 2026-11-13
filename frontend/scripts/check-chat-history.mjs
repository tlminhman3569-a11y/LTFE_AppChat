import { registerHooks } from 'node:module'

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === './socketClient' || specifier === './roomsApi') {
            return nextResolve(specifier + '.ts', context)
        }
        return nextResolve(specifier, context)
    },
})

const username = process.env.APPCHAT_PROBE_USER
const password = process.env.APPCHAT_PROBE_PASS
const target = process.env.APPCHAT_PROBE_PEOPLE
if (!username || !password || !target) {
    console.error('Cần APPCHAT_PROBE_USER, APPCHAT_PROBE_PASS và APPCHAT_PROBE_PEOPLE của hội thoại được phép thử')
    process.exit(1)
}

const { login } = await import('../src/services/authApi.ts')
const { loadHistory } = await import('../src/services/chatApi.ts')
const { socketClient } = await import('../src/services/socketClient.ts')
const deadline = setTimeout(() => {
    console.error('FAIL: quá thời gian kiểm tra')
    process.exit(1)
}, 25_000)

try {
    const session = await login(username, password)
    if (session.status !== 'success') throw new Error('LOGIN thất bại')
    const result = await loadHistory({ kind: 'people', name: target }, 1)
    if (result.status !== 'success') throw new Error('Không đọc được trang 1')

    const messages = result.data.messages
    if (!messages.every(message =>
        (message.name === username && message.to === target)
        || (message.name === target && message.to === username)
    )) throw new Error('Lịch sử chứa tin không thuộc cặp tài khoản thử')

    console.log(JSON.stringify({
        status: result.status,
        page: result.data.page,
        count: messages.length,
        sample: messages.slice(0, 1).map(message => ({
            id: message.id === undefined ? 'absent' : typeof message.id,
            name: '[đã che]',
            to: '[đã che]',
            mes: '[đã che]',
            createAt: message.createAt === undefined ? 'absent' : '[đã che]',
            kind: message.kind,
        })),
    }))
} catch (error) {
    console.error('FAIL:', error.message)
    process.exitCode = 1
} finally {
    clearTimeout(deadline)
    socketClient.disconnect()
}
