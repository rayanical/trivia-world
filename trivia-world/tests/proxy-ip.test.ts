import { expect, test } from 'bun:test';
import { signClientIp, verifiedClientIp } from '../src/lib/proxy-ip';

test('only fresh, untampered proxy signatures can supply the original client IP', () => {
    const secret = 'test-proxy-key-only';
    const now = 1791074000000;
    const headers = new Headers(signClientIp('198.51.100.20', secret, now));
    expect(verifiedClientIp(headers, secret, now)).toBe('198.51.100.20');
    expect(verifiedClientIp(headers, 'wrong-key', now)).toBeUndefined();
    expect(verifiedClientIp(headers, secret, now + 120_001)).toBeUndefined();
    expect(verifiedClientIp(headers, undefined, now)).toBeUndefined();
    headers.set('x-trivia-client-ip', '198.51.100.21');
    expect(verifiedClientIp(headers, secret, now)).toBeUndefined();
    expect(verifiedClientIp(new Headers({ 'x-trivia-client-ip': '198.51.100.20' }), secret, now)).toBeUndefined();
});
