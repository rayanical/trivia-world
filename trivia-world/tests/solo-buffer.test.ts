import { expect, test } from 'bun:test';
import { prefetchSoloQuestions, takeReadySoloQuestions, takeSoloQuestions } from '../src/lib/solo-buffer';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('prefetch deduplicates work and a consumed ready batch is never reused for replay', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = Object.assign(async () => { calls++; return Response.json([{ id: `issued-${calls}`, correct_answer: '4' }]); }, { preconnect: original.preconnect });
    try {
        prefetchSoloQuestions('buffer-alice'); prefetchSoloQuestions('buffer-alice');
        await tick();
        expect(calls).toBe(1);
        expect(takeReadySoloQuestions('buffer-alice', '', '')?.[0].id).toBe('issued-1');
        expect(takeReadySoloQuestions('buffer-alice', '', '')).toBeUndefined();
        expect((await takeSoloQuestions('buffer-alice', '', ''))[0].id).toBe('issued-2');
    } finally { globalThis.fetch = original; }
});
test('prefetched batches are scoped to both account and selected filters', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = Object.assign(async () => Response.json([{ id: `scoped-${++calls}` }]), { preconnect: original.preconnect });
    try {
        prefetchSoloQuestions('buffer-bob', 'science', 'easy');
        await tick();
        expect(takeReadySoloQuestions('buffer-carol', 'science', 'easy')).toBeUndefined();
        expect(takeReadySoloQuestions('buffer-bob', 'history', 'easy')).toBeUndefined();
        expect(takeReadySoloQuestions('buffer-bob', 'science', 'easy')?.[0].id).toBe('scoped-1');
    } finally { globalThis.fetch = original; }
});
