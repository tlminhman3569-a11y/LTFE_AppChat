type FetchError =
    | { kind: 'http'; statusCode: number; message: string }
    | { kind: 'network' | 'parse' | 'aborted'; message: string }

export type FetchResult<T> =
    | { status: 'success'; data: T }
    | { status: 'error'; error: FetchError }

export async function fetchJson<T>(url: string | URL, options?: RequestInit): Promise<FetchResult<T>> {
    let readingBody = false

    try {
        const res = await fetch(url, options)
        if (!res.ok) {
            return {
                status: 'error',
                error: {
                    kind: 'http',
                    statusCode: res.status,
                    message: `Máy chủ trả lỗi HTTP (${res.status})`,
                },
            }
        }

        readingBody = true
        const data: T = await res.json()
        return { status: 'success', data }
    } catch (err) {
        // Hủy bằng lý do riêng có thể không ném AbortError
        if (options?.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
            return { status: 'error', error: { kind: 'aborted', message: 'Đã hủy yêu cầu' } }
        }

        if (readingBody && err instanceof SyntaxError) {
            return { status: 'error', error: { kind: 'parse', message: 'Dữ liệu trả về không đọc được dưới dạng JSON' } }
        }

        const message = readingBody
            ? 'Không đọc được dữ liệu trả về'
            : 'Không có phản hồi từ máy chủ'
        return { status: 'error', error: { kind: 'network', message } }
    }
}
