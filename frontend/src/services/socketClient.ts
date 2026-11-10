import type { ConnectionStatus } from '../types/api'

type SocketResponse = { event: string; [key: string]: unknown }
type EventListener = (response: SocketResponse) => void

interface WaitingRequest {
    message: string
    resolve: (response: SocketResponse) => void
    reject: (error: Error) => void
}

interface Connection {
    socket: WebSocket
    url: string
    opened: Promise<void>
    requests: Map<string, WaitingRequest[]>
}

let connection: Connection | null = null
const listeners = new Map<string, Set<EventListener>>()

function connect(url: string): Promise<void> {
    if (connection && connection.socket.readyState !== WebSocket.CLOSED) {
        if (connection.socket.readyState === WebSocket.CLOSING) {
            return Promise.reject(new Error('Kết nối cũ đang đóng.'))
        }
        if (connection.url !== url) {
            return Promise.reject(new Error('Đóng kết nối hiện tại trước khi đổi địa chỉ.'))
        }
        return connection.opened
    }

    let socket: WebSocket
    try {
        socket = new WebSocket(url)
    } catch (error) {
        return Promise.reject(error)
    }

    const requests = new Map<string, WaitingRequest[]>()
    const opened = new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        socket.onerror = () => reject(new Error('Không mở được kết nối WebSocket.'))
        socket.onclose = () => {
            reject(new Error('Kết nối đã đóng trước khi mở.'))
            if (connection?.socket === socket) connection = null
            for (const queue of requests.values()) {
                for (const request of queue) {
                    request.reject(new Error('Kết nối đã đóng khi đang chờ kết quả.'))
                }
            }
            requests.clear()
            socket.onopen = null
            socket.onerror = null
            socket.onclose = null
            socket.onmessage = null
        }
    })

    const current = { socket, url, opened, requests }
    connection = current
    socket.onmessage = ({ data }) => {
        if (connection !== current || socket.readyState !== WebSocket.OPEN) return
        handleMessage(current, data)
    }
    return opened
}

function disconnect() {
    connection?.socket.close()
}

function getStatus(): ConnectionStatus {
    const readyState = connection?.socket.readyState
    if (readyState === WebSocket.CONNECTING) return 'connecting'
    if (readyState === WebSocket.OPEN) return 'connected'
    return 'disconnected'
}

function send(message: string) {
    const socket = connection?.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket chưa sẵn sàng để gửi.')
    }
    socket.send(message)
}

function subscribe(event: string, listener: EventListener) {
    // Giữ listener qua reconnect. Bên gọi hủy khi rời màn hoặc đổi phiên.
    const eventListeners = listeners.get(event) ?? new Set<EventListener>()
    listeners.set(event, eventListeners)
    eventListeners.add(listener)

    return () => {
        eventListeners.delete(listener)
        if (eventListeners.size === 0 && listeners.get(event) === eventListeners) {
            listeners.delete(event)
        }
    }
}

function sendNext(current: Connection, event: string, queue: WaitingRequest[]) {
    try {
        if (connection !== current || current.socket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket chưa sẵn sàng để gửi.')
        }
        current.socket.send(queue[0].message)
    } catch (error) {
        current.requests.delete(event)
        const sendError = error instanceof Error ? error : new Error('Không gửi được yêu cầu.')
        for (const request of queue) request.reject(sendError)
    }
}

function handleMessage(current: Connection, data: unknown) {
    if (typeof data !== 'string') return

    let response: SocketResponse
    try {
        response = JSON.parse(data)
    } catch {
        return
    }
    if (!response || typeof response.event !== 'string' || !response.event) return

    const event = response.event
    const queue = current.requests.get(event)
    if (queue) {
        // Mỗi event chỉ có một yêu cầu đã gửi đang chờ phản hồi.
        queue.shift()?.resolve(response)
        if (queue.length === 0) current.requests.delete(event)
        else sendNext(current, event, queue)
    }

    for (const listener of [...(listeners.get(event) ?? [])]) {
        try {
            listener(response)
        } catch (error) {
            console.error(error)
        }
    }
}

async function request(event: string, data?: Record<string, unknown>): Promise<SocketResponse> {
    if (event === 'SEND_CHAT') {
        throw new Error('Dùng send cho SEND_CHAT và đối chiếu tin nhắn riêng.')
    }

    const current = connection
    if (!current || current.socket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket chưa sẵn sàng để gửi.')
    }

    let responseEvent = event
    if (event === 'CHAT_CHECK_USER_EXIST') responseEvent = 'CHECK_USER_EXIST'
    if (event === 'CHAT_CHECK_USER_ONLINE') responseEvent = 'CHECK_USER_ONLINE'

    const message = JSON.stringify({ action: 'onchat', data: { event, data } })
    return new Promise((resolve, reject) => {
        const queue = current.requests.get(responseEvent) ?? []
        current.requests.set(responseEvent, queue)
        queue.push({ message, resolve, reject })
        if (queue.length === 1) sendNext(current, responseEvent, queue)
    })
}

export const socketClient = { connect, disconnect, getStatus, send, subscribe, request }
