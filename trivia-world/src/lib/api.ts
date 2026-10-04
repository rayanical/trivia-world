export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const timeout = AbortSignal.timeout(30_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetch(`/api${path}`, { ...options, signal, credentials: 'same-origin', cache: 'no-store' });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The server returned an unexpected response. Please try again shortly.'); }
    if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
    return data as T;
}

export function jsonBody(body: unknown): RequestInit {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
