import { expect, test } from 'bun:test';
import { AnswerOutbox } from '../src/lib/answer-outbox';
import { ApiError } from '../src/lib/api';
const storage = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('answer saving outlives its caller, deduplicates IDs, and survives reload', async () => {
    const disk = storage();
    const queue = new AnswerOutbox(async () => {}, disk);
    queue.enqueue('alice', { id: 'q1', answer: '4' });
    queue.enqueue('alice', { id: 'q1', answer: '4' });
    expect(queue.snapshot('alice').pending).toBe(1);
    const sent: string[] = [];
    const restored = new AnswerOutbox(async answer => { sent.push(answer.id); }, disk);
    restored.setOwner('bob');
    await tick();
    expect(sent).toEqual([]);
    restored.setOwner('alice');
    await tick();
    expect(sent).toEqual(['q1']);
    expect(restored.snapshot('alice').pending).toBe(0);
    restored.dispose(); queue.dispose();
});
test('temporary failures keep the answer for retry and permanent failures report unsaved statistics', async () => {
    const disk = storage();
    const queue = new AnswerOutbox(async () => { throw new ApiError('Unavailable', 503); }, disk);
    queue.setOwner('alice'); queue.enqueue('alice', { id: 'q1', answer: '4' });
    await tick();
    expect(queue.snapshot('alice')).toEqual({ pending: 1, failed: 0 });
    queue.dispose();
    const data = JSON.parse(disk.getItem('trivia.answers.v1')!); data[0].retryAt = 0;
    disk.setItem('trivia.answers.v1', JSON.stringify(data));
    const restored = new AnswerOutbox(async () => { throw new ApiError('Expired', 404); }, disk);
    restored.setOwner('alice');
    await tick();
    expect(restored.snapshot('alice')).toEqual({ pending: 0, failed: 1 });
    restored.dispose();
});
test('switching accounts during a send does not flush the previous account backlog', async () => {
    let finish: (() => void) | undefined;
    const sent: string[] = [];
    const queue = new AnswerOutbox(answer => { sent.push(answer.id); return new Promise<void>(resolve => { finish = resolve; }); });
    queue.setOwner('alice'); queue.enqueue('alice', { id: 'q1', answer: '4' }); queue.enqueue('alice', { id: 'q2', answer: '4' });
    queue.setOwner('bob'); finish?.(); await tick();
    expect(sent).toEqual(['q1']);
    expect(queue.snapshot('alice').pending).toBe(1);
    queue.dispose();
});
