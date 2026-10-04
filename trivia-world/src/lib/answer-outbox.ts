import { api, ApiError, jsonBody } from './api';

type Answer = { id: string; token?: string; answer: string };
type Pending = Answer & { owner: string; expires: number; attempts: number; retryAt: number };
export type SaveState = { pending: number; failed: number };
const empty: SaveState = { pending: 0, failed: 0 };

/** One tab's durable answer queue. Network work outlives the game component. */
export class AnswerOutbox {
    private jobs: Pending[] = [];
    private failures = new Map<string, number>();
    private listeners = new Set<() => void>();
    private states = new Map<string, SaveState>();
    private owner: string | null = null;
    private sending = false;
    private timer?: ReturnType<typeof setTimeout>;
    constructor(private send: (answer: Answer) => Promise<unknown>, private storage?: Pick<Storage, 'getItem' | 'setItem'>) {
        try {
            const data: unknown = JSON.parse(storage?.getItem('trivia.answers.v1') || '[]');
            if (Array.isArray(data)) this.jobs = data.filter((job): job is Pending =>
                job && typeof job.id === 'string' && typeof job.owner === 'string' && typeof job.answer === 'string' &&
                (job.token === undefined || typeof job.token === 'string') && typeof job.expires === 'number' && job.expires > Date.now() &&
                Number.isInteger(job.attempts) && typeof job.retryAt === 'number').slice(0, 500);
        } catch { /* Storage may be disabled; the in-memory queue still works. */ }
        this.publish();
    }
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    snapshot = (owner: string) => this.states.get(owner) || empty;
    setOwner(owner: string | null) { this.owner = owner; void this.flush(); }
    enqueue(owner: string, answer: Answer) {
        if (this.jobs.some(job => job.id === answer.id)) return;
        if (this.jobs.length >= 500) { this.failures.set(owner, (this.failures.get(owner) || 0) + 1); this.publish(); return; }
        this.jobs.push({ ...answer, owner, expires: Date.now() + 23 * 3_600_000, attempts: 0, retryAt: 0 });
        this.publish();
        void this.flush();
    }
    private publish() {
        try { this.storage?.setItem('trivia.answers.v1', JSON.stringify(this.jobs)); } catch { /* Keep saving from memory. */ }
        const owners = new Set([...this.states.keys(), ...this.jobs.map(job => job.owner), ...this.failures.keys()]);
        for (const owner of owners) {
            const state = { pending: this.jobs.filter(job => job.owner === owner).length, failed: this.failures.get(owner) || 0 };
            const previous = this.states.get(owner);
            if (previous?.pending !== state.pending || previous?.failed !== state.failed) this.states.set(owner, state);
        }
        for (const listener of this.listeners) listener();
    }
    flush = async () => {
        if (this.sending || !this.owner) return;
        clearTimeout(this.timer);
        const job = this.jobs.find(item => item.owner === this.owner);
        if (!job) return;
        if (job.expires <= Date.now()) { this.drop(job); return; }
        if (job.retryAt > Date.now()) { this.timer = setTimeout(() => { void this.flush(); }, job.retryAt - Date.now()); return; }
        this.sending = true;
        try {
            await this.send({ id: job.id, token: job.token, answer: job.answer });
            this.jobs = this.jobs.filter(item => item !== job);
        } catch (error) {
            if (error instanceof ApiError && [400, 404, 409, 410].includes(error.status)) this.drop(job);
            else {
                job.attempts++;
                job.retryAt = Date.now() + Math.min(60_000, 1_000 * 2 ** Math.min(job.attempts - 1, 6));
            }
        } finally {
            this.sending = false;
            this.publish();
            void this.flush();
        }
    };
    private drop(job: Pending) {
        this.jobs = this.jobs.filter(item => item !== job);
        this.failures.set(job.owner, (this.failures.get(job.owner) || 0) + 1);
        this.publish();
        if (!this.sending) void this.flush();
    }
    dispose() { clearTimeout(this.timer); this.owner = null; }
}
let outbox: AnswerOutbox | undefined;
export function getAnswerOutbox() {
    if (!outbox) {
        let storage: Storage | undefined;
        try { storage = window.sessionStorage; } catch { /* Private browser restrictions. */ }
        outbox = new AnswerOutbox(answer => api('/solo/answer', { ...jsonBody(answer), keepalive: true }), storage);
    }
    return outbox;
}
export const emptySaveState = empty;
