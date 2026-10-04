// Retry only the connection before acquiring a migration lock or running SQL.
// Authentication/configuration errors should still fail deployment immediately.
export async function connectWithRetry<T>(connect: () => Promise<T>, wait: (milliseconds: number) => Promise<unknown> = milliseconds => Bun.sleep(milliseconds)): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try { return await connect(); }
        catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            const transient = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', '57P03', '57P01'].includes(String(code)) ||
                (error instanceof Error && /connection timeout|connection terminated unexpectedly/i.test(error.message));
            if (!transient || attempt >= 3) throw error;
            console.warn(`Database connection temporarily unavailable; retrying startup (${attempt}/3).`);
            await wait(attempt * 1000);
        }
    }
}
