import { expect, test } from 'bun:test';
import { QuestionPool } from '../src/server/question-pool';

test('cached questions are consumed once and concurrent requests share refill work', async () => {
    let sequence = 0;
    let calls = 0;
    const pool = new QuestionPool(async (amount: number) => { calls++; await Promise.resolve(); return Array.from({ length: amount }, () => ++sequence); });
    const [first, second] = await Promise.all([pool.take(5), pool.take(5)]);
    expect(calls).toBe(1);
    expect(first).toHaveLength(5);
    expect(second).toHaveLength(5);
    expect(new Set([...first, ...second]).size).toBe(10);
    expect(await pool.take(5)).toEqual([11, 12, 13, 14, 15]);
    expect(calls).toBe(1);
});
test('concurrent requests that exhaust a shared refill receive disjoint batches', async () => {
    let sequence = 0;
    const pool = new QuestionPool(async (amount: number) => Array.from({ length: amount }, () => ++sequence));
    const groups = await Promise.all([pool.take(30), pool.take(30), pool.take(30)]);
    expect(groups.every(group => group.length === 30)).toBe(true);
    expect(new Set(groups.flat()).size).toBe(90);
});
test('expired pools and different filters cannot replay an old cached batch', async () => {
    let now = 0;
    let calls = 0;
    const pool = new QuestionPool(async (amount, category) => { calls++; return Array.from({ length: amount }, (_, i) => `${category}:${calls}:${i}`); }, () => now);
    expect((await pool.take(1, 'science'))[0]).toBe('science:1:0');
    expect((await pool.take(1, 'history'))[0]).toBe('history:2:0');
    now = 600_001;
    expect((await pool.take(1, 'science'))[0]).toBe('science:3:0');
});
