import { expect, test } from 'bun:test';
import { connectWithRetry } from '../src/server/connect-with-retry';

test('a transient startup timeout retries only the connection and returns the connected client', async () => {
    let attempts = 0;
    const waits: number[] = [];
    const client = { connected: true };
    const result = await connectWithRetry(async () => {
        if (++attempts === 1) throw new Error('Connection terminated due to connection timeout');
        return client;
    }, async milliseconds => { waits.push(milliseconds); });
    expect(result).toBe(client);
    expect(attempts).toBe(2);
    expect(waits).toEqual([1000]);
});

test('persistent connection failures stop after three attempts', async () => {
    let attempts = 0;
    const waits: number[] = [];
    await expect(connectWithRetry(async () => {
        attempts++;
        throw Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
    }, async milliseconds => { waits.push(milliseconds); })).rejects.toThrow('Connection reset');
    expect(attempts).toBe(3);
    expect(waits).toEqual([1000, 2000]);
});

test('invalid credentials fail immediately instead of delaying deployment', async () => {
    let attempts = 0;
    await expect(connectWithRetry(async () => {
        attempts++;
        throw Object.assign(new Error('Password authentication failed'), { code: '28P01' });
    }, async () => { throw new Error('Unexpected retry'); })).rejects.toThrow('Password authentication failed');
    expect(attempts).toBe(1);
});
