import { api, jsonBody } from './api';

export type SoloQuestion = {
    id: string; token?: string; question: string; difficulty: 'easy' | 'medium' | 'hard';
    category: string; correct_answer?: string; all_answers: string[];
};
type Entry = { expires: number; promise: Promise<SoloQuestion[]>; ready?: SoloQuestion[] };
const batches = new Map<string, Entry>();
const keyFor = (owner: string, category: string, difficulty: string) => JSON.stringify([owner, category, difficulty]);

function batch(owner: string, category: string, difficulty: string) {
    const key = keyFor(owner, category, difficulty);
    const existing = batches.get(key);
    if (existing && existing.expires > Date.now()) return existing;
    batches.delete(key);
    // At most four filter combinations are retained, and issued batches live five minutes.
    if (batches.size >= 4) batches.delete(batches.keys().next().value!);
    const entry: Entry = { expires: Date.now() + 300_000, promise: Promise.resolve([]) };
    entry.promise = api<SoloQuestion[]>('/solo/questions', jsonBody({ category: category || undefined, difficulty: difficulty || undefined }))
        .then(questions => { entry.ready = questions; return questions; })
        .catch(error => { if (batches.get(key) === entry) batches.delete(key); throw error; });
    batches.set(key, entry);
    return entry;
}
export function prefetchSoloQuestions(owner: string, category = '', difficulty = '') {
    void batch(owner, category, difficulty).promise.catch(() => {});
}
export function takeReadySoloQuestions(owner: string, category: string, difficulty: string) {
    const key = keyFor(owner, category, difficulty);
    const entry = batches.get(key);
    if (!entry?.ready || entry.expires <= Date.now()) return undefined;
    batches.delete(key);
    return entry.ready;
}
export async function takeSoloQuestions(owner: string, category: string, difficulty: string) {
    const key = keyFor(owner, category, difficulty);
    const entry = batch(owner, category, difficulty);
    // Reserve before awaiting: another game cannot claim the same question IDs.
    if (batches.get(key) === entry) batches.delete(key);
    return entry.promise;
}
