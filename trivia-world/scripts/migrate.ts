import { getMigrations } from 'better-auth/db/migration';
import { createHash } from 'node:crypto';
import { requiredEnv } from '../src/server/config';

// Session-level migration locks need a direct connection, not transaction pooling.
const migrationUrl = new URL(process.env.DATABASE_URL_UNPOOLED || requiredEnv('DATABASE_URL'));
if (migrationUrl.hostname.endsWith('.neon.tech')) {
    migrationUrl.hostname = migrationUrl.hostname.replace('-pooler.', '.');
}
process.env.DATABASE_URL = migrationUrl.toString();
const [{ auth }, { db }] = await Promise.all([import('../src/server/auth'), import('../src/server/db')]);

const client = await db.connect();
try {
    // Serialize deployments so two instances cannot modify the schema at once.
    await client.query("SELECT pg_advisory_lock(hashtext('trivia-world-migrations'))");
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const name = '001-app.sql';
    const source = await Bun.file(new URL(`../migrations/${name}`, import.meta.url)).text();
    const checksum = createHash('sha256').update(source).digest('hex');
    const previous = await client.query('SELECT checksum FROM app_migrations WHERE name = $1', [name]);
    if (previous.rows.length && previous.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
    if (!previous.rows.length) {
        await client.query('BEGIN');
        await client.query(source);
        await client.query('INSERT INTO app_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
        await client.query('COMMIT');
    }
    console.info('Database migrations complete.');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('trivia-world-migrations'))");
    client.release();
    await db.end();
}
