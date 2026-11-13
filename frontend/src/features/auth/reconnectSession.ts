import { reLogin } from '../../services/authApi'
import { clearStoredSession, readStoredSession } from '../../services/sessionStorage'
import { socketClient } from '../../services/socketClient'
import { store } from '../../store'
import { connectionStatusChanged, sessionCleared, sessionReconnected } from '../../store/slices/authSlice'

const retryDelays = [500, 1000, 2000]

export function watchSocketConnection() {
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let activeRun: object | null = null

    function startReconnect(generation: number, username: string) {
        const run = {}
        activeRun = run
        store.dispatch(connectionStatusChanged('reconnecting'))

        function isCurrent() {
            const auth = store.getState().auth
            return activeRun === run && auth.authStatus === 'authenticated'
                && auth.sessionGeneration === generation && readStoredSession()?.username === username
        }

        function finish() {
            if (activeRun !== run) return
            activeRun = null
            if (store.getState().auth.sessionGeneration !== generation) return
            store.dispatch(connectionStatusChanged('disconnected'))
        }

        function schedule(attempt: number) {
            if (!isCurrent() || attempt >= retryDelays.length) {
                finish()
                return
            }

            retryTimer = setTimeout(() => { void reconnect(attempt) }, retryDelays[attempt])
        }

        async function reconnect(attempt: number) {
            const saved = readStoredSession()
            if (!isCurrent() || !saved) {
                finish()
                return
            }

            const res = await reLogin(saved, isCurrent)
            if (!isCurrent()) {
                finish()
                return
            }

            if (res.status === 'success' && socketClient.getStatus() === 'connected') {
                activeRun = null
                store.dispatch(sessionReconnected())
                return
            }

            if (res.status === 'error' && (res.error.kind === 'session' || res.error.kind === 'parse')) {
                clearStoredSession()
                socketClient.clearSessionListeners()
                store.dispatch(sessionCleared({ restoreError: res.error.message }))
                activeRun = null
                return
            }

            socketClient.disconnect()
            schedule(attempt + 1)
        }

        schedule(0)
    }

    let generation = store.getState().auth.sessionGeneration
    const unsubscribeStore = store.subscribe(() => {
        const nextGeneration = store.getState().auth.sessionGeneration
        if (nextGeneration === generation) return

        generation = nextGeneration
        activeRun = null
        clearTimeout(retryTimer)
    })

    const unsubscribe = socketClient.subscribeStatus(status => {
        if (activeRun) return

        const auth = store.getState().auth
        const saved = status === 'disconnected' && auth.authStatus === 'authenticated'
            ? readStoredSession()
            : null

        if (saved && saved.username === auth.currentUser && auth.connectionStatus === 'connected') {
            startReconnect(auth.sessionGeneration, saved.username)
            return
        }

        store.dispatch(connectionStatusChanged(status))
    })

    return () => {
        activeRun = null
        unsubscribeStore()
        clearTimeout(retryTimer)
        unsubscribe()
    }
}
