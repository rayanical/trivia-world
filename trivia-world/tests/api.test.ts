import { afterEach, expect, test } from 'bun:test';
import { api } from '../src/lib/api';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function stubFetch(handler: (input: Parameters<typeof fetch>[0], options?: RequestInit) => Promise<Response>) {
    globalThis.fetch = Object.assign(handler, { preconnect: originalFetch.preconnect });
}

test('HTML gateway failures produce a useful retry message instead of a JSON parsing error', async () => {
    stubFetch(async () => new Response('<html>Gateway unavailable</html>', { status: 503 }));
    await expect(api('/solo/questions')).rejects.toThrow('The server returned an unexpected response. Please try again shortly.');
});

test('API errors retain the server explanation', async () => {
    stubFetch(async () => Response.json({ error: 'That question expired. Please load another.' }, { status: 404 }));
    await expect(api('/solo/answer')).rejects.toThrow('That question expired. Please load another.');
});

test('navigation cancellation reaches the in-flight API request', async () => {
    stubFetch(async (_input, options) => new Promise((_resolve, reject) => {
        const signal = options?.signal;
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const controller = new AbortController();
    const request = api('/solo/questions', { signal: controller.signal });
    controller.abort(new Error('Navigation cancelled'));
    await expect(request).rejects.toThrow('Navigation cancelled');
});
