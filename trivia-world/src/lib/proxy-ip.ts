import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

// Only our server-side Next proxy may supply a player's original IP to Render.
export function signClientIp(ip: string, secret: string, now = Date.now()): Record<string, string> {
    if (!isIP(ip)) return {};
    const timestamp = String(now);
    return {
        'x-trivia-client-ip': ip,
        'x-trivia-proxy-time': timestamp,
        'x-trivia-proxy-signature': createHmac('sha256', secret).update(`${timestamp}:${ip}`).digest('hex'),
    };
}

export function verifiedClientIp(headers: Pick<Headers, 'get'>, secret: string | undefined, now = Date.now()): string | undefined {
    if (!secret) return undefined;
    const ip = headers.get('x-trivia-client-ip') || '';
    const timestamp = headers.get('x-trivia-proxy-time') || '';
    const signature = headers.get('x-trivia-proxy-signature') || '';
    if (!isIP(ip) || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 120_000 || !/^[a-f0-9]{64}$/.test(signature)) return undefined;
    const expected = createHmac('sha256', secret).update(`${timestamp}:${ip}`).digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex')) ? ip : undefined;
}
