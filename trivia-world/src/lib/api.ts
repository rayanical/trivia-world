export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
    return data as T;
}

export function jsonBody(body: unknown): RequestInit {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

