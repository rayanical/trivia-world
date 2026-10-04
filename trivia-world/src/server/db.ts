import { Pool } from 'pg';
import { requiredEnv } from './config';

// Neon supplies TLS settings in its connection string. Never disable certificate verification.
export const db = new Pool({
    connectionString: requiredEnv('DATABASE_URL'),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
});
db.on('error', (error) => console.error('Unexpected database connection error', error.message));

