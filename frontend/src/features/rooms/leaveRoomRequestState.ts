export type LeaveStatus = 'pending' | 'unknown' | 'error' | 'success'

export type LeaveRequest = {
    status: LeaveStatus
    message: string
}

const requests = new Map<string, LeaveRequest>()
const listeners = new Set<() => void>()

function keyFor(sessionGeneration: number, name: string) {
    return JSON.stringify([sessionGeneration, name])
}

function notify() {
    listeners.forEach(listener => listener())
}

export function subscribeLeaveRequests(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

export function getLeaveRequest(sessionGeneration: number, name: string) {
    return requests.get(keyFor(sessionGeneration, name)) ?? null
}

export function updateLeaveRequest(sessionGeneration: number, name: string, request: LeaveRequest) {
    requests.set(keyFor(sessionGeneration, name), request)
    notify()
}

export function resetLeaveAfterJoin(sessionGeneration: number, name: string) {
    const key = keyFor(sessionGeneration, name)
    if (requests.get(key)?.status !== 'success') return false
    requests.delete(key)
    notify()
    return true
}
