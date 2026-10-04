type Pool<T> = { values: T[]; expires: number; refill?: Promise<number> };

/** Consumable provider cache: issued questions are removed rather than replayed. */
export class QuestionPool<T> {
    private pools = new Map<string, Pool<T>>();
    constructor(private load: (amount: number, category?: string, difficulty?: string) => Promise<T[]>, private now = Date.now) {}
    async take(amount: number, category?: string, difficulty?: string) {
        const key = JSON.stringify([category || '', difficulty || '']);
        let pool = this.pools.get(key);
        if (!pool || pool.expires <= this.now()) {
            if (this.pools.size >= 12) this.pools.delete(this.pools.keys().next().value!);
            pool = { values: [], expires: this.now() + 600_000 };
            this.pools.set(key, pool);
        }
        return this.consume(pool, amount, category, difficulty);
    }
    private consume(pool: Pool<T>, amount: number, category?: string, difficulty?: string): Promise<T[]> {
        if (pool.values.length < amount) {
            // Recheck stock after shared work: another caller may have consumed it.
            return this.refill(pool, Math.max(amount, 30), category, difficulty).then(received => {
                if (!received) throw new Error('No questions available. Please try again.');
                return this.consume(pool, amount, category, difficulty);
            });
        }
        const result = pool.values.splice(0, amount);
        if (pool.values.length <= 10) void this.refill(pool, 30, category, difficulty).catch(() => {});
        return Promise.resolve(result);
    }
    private refill(pool: Pool<T>, amount: number, category?: string, difficulty?: string) {
        if (!pool.refill) {
            pool.refill = this.load(amount, category, difficulty)
                .then(values => { pool.values.push(...values); return values.length; })
                .finally(() => { pool.refill = undefined; });
        }
        return pool.refill;
    }
}
