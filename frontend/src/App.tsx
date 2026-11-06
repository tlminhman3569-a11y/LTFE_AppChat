import AppRoutes from './routes'
import SessionPreview from './components/SessionPreview'

export default function App() {
    return (
        <>
            {import.meta.env.DEV && <SessionPreview />}
            <AppRoutes />
        </>
    )
}
