// Utility for API requests from the frontend
export function getToken() {
    return localStorage.getItem('zen_token')
}

export async function apiRequest(path: string, method = 'GET', body?: any) {
    const token = getToken()
    const apiKey = import.meta.env.VITE_API_KEY
    const opts: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(apiKey ? { 'x-api-key': apiKey } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    }
    const res = await fetch(`/api${path}`, opts)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'API error')
    return data
}
