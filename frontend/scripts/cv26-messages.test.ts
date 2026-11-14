import { afterEach, expect, it, vi } from 'vitest'
import { sendText } from '../src/services/chatApi'
import { socketClient } from '../src/services/socketClient'

afterEach(() => vi.restoreAllMocks())

it('gửi đúng loại, đích và nội dung qua socket chung', () => {
    const send = vi.spyOn(socketClient, 'send').mockImplementation(() => {})
    for (const kind of ['people', 'room'] as const) {
        sendText({ kind, name: 'Demo' }, ' Tin mẫu ')
        expect(JSON.parse(send.mock.lastCall![0])).toEqual({
            action: 'onchat',
            data: { event: 'SEND_CHAT', data: { type: kind, to: 'Demo', mes: ' Tin mẫu ' } },
        })
    }
    expect(() => sendText({ kind: 'people', name: 'Demo' }, '  ')).toThrow()
    expect(send).toHaveBeenCalledTimes(2)
})
