import type { NextRequest } from 'next/server';
import { signClientIp } from '@/lib/proxy-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const backend = process.env.BACKEND_URL;
    if (!backend) return Response.json({ error: 'The backend is not configured.' }, { status: 503 });
    const { path } = await context.params;
    if (path.some((part) => part === '.' || part === '..' || part.includes('/'))) {
        return Response.json({ error: 'Invalid request path.' }, { status: 400 });
    }
    const target = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, backend);
    target.search = request.nextUrl.search;
    const headers = new Headers();
    for (const name of ['cookie', 'content-type', 'origin', 'referer', 'sec-fetch-site', 'sec-fetch-mode', 'if-none-match']) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }
    // Vercel overwrites this header at its edge; never forward client-supplied signatures.
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (clientIp && process.env.PROXY_SHARED_SECRET) {
        for (const [name, value] of Object.entries(signClientIp(clientIp, process.env.PROXY_SHARED_SECRET))) headers.set(name, value);
    }
    try {
        if (Number(request.headers.get('content-length')) > 2 * 1024 * 1024) return Response.json({ error: 'Maximum upload size is 2 MB.' }, { status: 413 });
        const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
        if (body && body.byteLength > 2 * 1024 * 1024) return Response.json({ error: 'Maximum upload size is 2 MB.' }, { status: 413 });
        const response = await fetch(target, { method: request.method, headers, body, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(55_000) });
        const outgoing = new Headers();
        for (const name of ['content-type', 'cache-control', 'etag', 'location', 'x-content-type-options']) {
            const value = response.headers.get(name);
            if (value) outgoing.set(name, value);
        }
        for (const cookie of response.headers.getSetCookie()) outgoing.append('set-cookie', cookie);
        // No session or account response may be cached by Vercel or a browser.
        if (!path[0]?.startsWith('avatars')) outgoing.set('cache-control', 'no-store');
        return new Response(response.body, { status: response.status, headers: outgoing });
    } catch {
        return Response.json({ error: 'The server is unavailable. Please try again shortly.' }, { status: 503 });
    }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE, proxy as HEAD };
