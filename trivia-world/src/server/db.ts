import { Pool } from 'pg';
import { requiredEnv } from './config';

// Neon supplies TLS settings in its connection string. Never disable certificate verification.
const connectionUrl = new URL(requiredEnv('DATABASE_URL'));
if (connectionUrl.searchParams.get('sslmode') === 'require') connectionUrl.searchParams.set('sslmode', 'verify-full');
export const db = new Pool({
    connectionString: connectionUrl.toString(),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
});
db.on('error', (error) => console.error('Unexpected database connection error', error.message));
