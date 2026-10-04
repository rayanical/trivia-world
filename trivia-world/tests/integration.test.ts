import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { io, type Socket } from 'socket.io-client';
import { signClientIp } from '../src/lib/proxy-ip';

// Run only against a disposable local database. No production emails or trivia calls.
const testDatabase = process.env.TEST_DATABASE_URL;
if (!testDatabase || !['localhost', '127.0.0.1'].includes(new URL(testDatabase).hostname)) {
    throw new Error('Set TEST_DATABASE_URL to a disposable local Postgres database and run db:migrate first.');
}
process.env.DATABASE_URL = testDatabase;
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'local-test-secret-not-for-production-12345678';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_FROM_EMAIL = 'test@example.com';
const testProxySecret = 'test-proxy-shared-secret';
process.env.PROXY_SHARED_SECRET = testProxySecret;
process.env.PORT = '3101';
const base = 'http://127.0.0.1:3101';
const emails: { to: string; text: string }[] = [];
mock.module('resend', () => ({ Resend: class { emails = { send: async (email: { to: string; text: string }) => { emails.push(email); return { data: { id: 'test' }, error: null }; } }; } }));
const originalFetch = globalThis.fetch;
globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).startsWith('https://the-trivia-api.com/')) {
        return Response.json(Array.from({ length: Number(new URL(String(input)).searchParams.get('limit')) || 10 }, () => ({ question: { text: 'What is 2 + 2?' }, category: 'science', difficulty: 'easy', correctAnswer: '4', incorrectAnswers: ['1', '2', '3'] })));
    }
    return originalFetch(input, init);
}, { preconnect: originalFetch.preconnect });

let shutdown: () => Promise<void>;
let cookie = '';
let token = '';
let userId = '';
const sockets: Socket[] = [];
const post = (path: string, body: unknown, sessionCookie = cookie) => fetch(`${base}${path}`, {
    method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json', Cookie: sessionCookie }, body: JSON.stringify(body),
});
function event<T>(socket: Socket, name: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out waiting for ${name}`)); }, 8000);
        const listener = (data: T) => { clearTimeout(timeout); resolve(data); };
        socket.once(name, listener);
    });
}
async function connect(auth: object) {
    const socket = io(base, { autoConnect: false, transports: ['websocket'], auth, extraHeaders: { Origin: 'http://localhost:3000' } });
    sockets.push(socket);
    const connected = event(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
}

beforeAll(async () => {
    const server = await import('../server');
    shutdown = server.stopServer;
    const email = `migration-${randomUUID()}@example.com`;
    const signup = await post('/api/auth/sign-up/email', { email, password: 'TestPass123!', name: 'Test Player', callbackURL: 'http://localhost:3000' }, '');
    expect(signup.ok).toBe(true);
    const blocked = await post('/api/auth/sign-in/email', { email, password: 'TestPass123!' }, '');
    expect(blocked.status).toBe(403);
    const verification = emails.find((message) => message.to === email)!.text.match(/https?:\/\/[^\s]+/)![0];
    const url = new URL(verification);
    const verified = await fetch(`${base}${url.pathname}${url.search}`, { redirect: 'manual' });
    expect(verified.status).toBe(302);
    const signin = await fetch(`${base}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json', ...signClientIp('198.51.100.20', testProxySecret) },
        body: JSON.stringify({ email, password: 'TestPass123!' }),
    });
    expect(signin.ok).toBe(true);
    cookie = signin.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const session = await (await fetch(`${base}/api/auth/get-session`, { headers: { Cookie: cookie } })).json();
    token = session.session.token;
    userId = session.user.id;
    expect(session.session.ipAddress).toBe('198.51.100.20');
}, 20_000);

afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    if (shutdown) await shutdown();
    globalThis.fetch = originalFetch;
});

test('profiles require a session and reject forged image changes', async () => {
    expect((await fetch(`${base}/api/profile`)).status).toBe(401);
    const update = await post('/api/profile', { username: 'New Name' });
    expect(update.ok).toBe(true);
    const profile = await (await fetch(`${base}/api/profile`, { headers: { Cookie: cookie } })).json();
    expect(profile.username).toBe('New Name');
    expect((await post('/api/auth/update-user', { image: 'https://attacker.example/image' })).status).toBe(400);
    expect((await post('/api/profile', { username: 'x' })).status).toBe(400);
});

test('avatar bytes are validated, stored, and cached; a failed upload retains the previous avatar', async () => {
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: 'green' } }).png().toBuffer();
    const uploaded = await fetch(`${base}/api/avatar`, { method: 'POST', headers: { Origin: 'http://localhost:3000', Cookie: cookie, 'Content-Type': 'image/png' }, body: image });
    expect(uploaded.ok).toBe(true);
    const { avatar_url: url } = await uploaded.json();
    const avatar = await fetch(`${base}${url}`);
    expect(avatar.headers.get('content-type')).toContain('image/webp');
    expect((await sharp(Buffer.from(await avatar.arrayBuffer())).metadata()).width).toBe(256);
    expect((await fetch(`${base}${url}`, { headers: { 'If-None-Match': avatar.headers.get('etag')! } })).status).toBe(304);
    const invalid = await fetch(`${base}/api/avatar`, { method: 'POST', headers: { Origin: 'http://localhost:3000', Cookie: cookie, 'Content-Type': 'image/png' }, body: 'not an image' });
    expect(invalid.status).toBe(400);
    expect((await fetch(`${base}${url}`)).ok).toBe(true);
});

test('solo answers are server scored and retries increment stats only once', async () => {
    const response = await post('/api/solo/questions', { difficulty: 'easy' });
    const [question] = await response.json();
    expect(question.correct_answer).toBeUndefined();
    expect((await post('/api/solo/answer', { id: question.id, answer: '4' }, '')).status).toBe(404);
    expect((await post('/api/solo/answer', { id: question.id, answer: 'not offered' })).status).toBe(400);
    const body = { id: question.id, answer: '4' };
    expect(await (await post('/api/solo/answer', body)).json()).toEqual({ correct: true, correctAnswer: '4' });
    expect((await post('/api/solo/answer', body)).ok).toBe(true);
    expect((await post('/api/solo/answer', { ...body, answer: '3' })).status).toBe(409);
    const stats = await (await fetch(`${base}/api/stats`, { headers: { Cookie: cookie } })).json();
    expect(stats.solo_questions_answered).toBe(1);
    expect(stats.solo_easy_correct).toBe(1);
    expect(stats.user_id).toBe(userId);
});

test('guest solo questions use an owner token without creating account statistics', async () => {
    const [question] = await (await post('/api/solo/questions', {}, '')).json();
    expect((await post('/api/solo/answer', { id: question.id, answer: '4' }, '')).status).toBe(404);
    expect((await post('/api/solo/answer', { id: question.id, token: question.token, answer: '4' }, '')).ok).toBe(true);
});

test('password reset verifies a token and invalidates existing sessions', async () => {
    const session = await (await fetch(`${base}/api/auth/get-session`, { headers: { Cookie: cookie } })).json();
    expect((await post('/api/auth/reset-password', { token: 'invalid', newPassword: 'OtherPass123!' }, '')).ok).toBe(false);
    expect((await post('/api/auth/request-password-reset', { email: session.user.email, redirectTo: 'http://localhost:3000/reset-password' }, '')).ok).toBe(true);
    const message = emails.at(-1)!.text.match(/https?:\/\/[^\s]+/)![0];
    const resetUrl = new URL(message);
    const redirect = await fetch(`${base}${resetUrl.pathname}${resetUrl.search}`, { redirect: 'manual' });
    const resetToken = new URL(redirect.headers.get('location')!).searchParams.get('token');
    expect((await post('/api/auth/reset-password', { token: resetToken, newPassword: 'OtherPass123!' }, '')).ok).toBe(true);
    expect(await (await fetch(`${base}/api/auth/get-session`, { headers: { Cookie: cookie } })).json()).toBeNull();
    const signin = await post('/api/auth/sign-in/email', { email: session.user.email, password: 'OtherPass123!' }, '');
    cookie = signin.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    token = (await (await fetch(`${base}/api/auth/get-session`, { headers: { Cookie: cookie } })).json()).session.token;
});

test('multiplayer hides answers and saves authenticated results once per match', async () => {
    const host = await connect({ token });
    const created = event<string>(host, 'game-created');
    host.emit('create-game', { name: 'Forged Guest Name', avatar: 'https://attacker.example/image' });
    const code = await created;
    const questionEvent = event<{ correct_answer?: string; index: number }>(host, 'question');
    host.emit('start-game', { gameCode: code, settings: { amount: 1, timeLimit: null } });
    const question = await questionEvent;
    expect(question.correct_answer).toBeUndefined();
    const gameOver = event(host, 'game-over');
    host.emit('submit-answer', { gameCode: code, questionIndex: question.index, answer: '4' });
    host.emit('submit-answer', { gameCode: code, questionIndex: question.index, answer: '4' });
    await gameOver;
    const stats = await (await fetch(`${base}/api/stats`, { headers: { Cookie: cookie } })).json();
    expect(stats.multiplayer_questions_correct).toBe(1);
    expect(stats.multiplayer_games_played).toBe(1);
}, 40_000);
