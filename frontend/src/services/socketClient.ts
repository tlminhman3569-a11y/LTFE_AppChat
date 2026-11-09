import type { ConnectionStatus } from '../types/api'

let connection: { socket: WebSocket; url: string; opened: Promise<void> } | null = null

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

    const opened = new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        socket.onerror = () => reject(new Error('Không mở được kết nối WebSocket.'))
        socket.onclose = () => {
            reject(new Error('Kết nối đã đóng trước khi mở.'))
            if (connection?.socket === socket) connection = null
            socket.onopen = null
            socket.onerror = null
            socket.onclose = null
        }
    })

    connection = { socket, url, opened }
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

export const socketClient = { connect, disconnect, getStatus, send }
