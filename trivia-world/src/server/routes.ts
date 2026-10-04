import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import sharp from 'sharp';
import express from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { auth, googleEnabled } from './auth';
import { db } from './db';
import { trustedOrigins } from './config';
import { fetchQuestions, shuffle } from './trivia';
import { recordQuestion, type Difficulty } from './stats';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const routes = Router();
routes.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.get('origin');
        if (origin && !trustedOrigins.includes(origin)) return void res.status(403).json({ error: 'Untrusted origin.' });
        if (!req.is('application/json') && !req.is('image/*')) return void res.status(415).json({ error: 'Unsupported content type.' });
    }
    next();
});
routes.get('/config', (_req, res) => res.json({ googleEnabled }));

routes.use(async (req, res, next) => {
    try {
        res.locals.session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        next();
    } catch (error) { next(error); }
});

// A bounded limiter also covers anonymous solo requests from each upstream host.
const limits = new Map<string, { count: number; reset: number }>();
routes.use((req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method)) return next();
    const now = Date.now();
    for (const [key, value] of limits) if (value.reset <= now) limits.delete(key);
    const key = res.locals.session?.user.id || req.ip || 'anonymous';
    const current = limits.get(key) || { count: 0, reset: now + 60_000 };
    if (++current.count > 120 || limits.size > 10_000) return void res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    limits.set(key, current);
    next();
});

routes.get('/profile', (req, res) => {
    const user = res.locals.session?.user;
    if (!user) return void res.status(401).json({ error: 'Please sign in.' });
    res.json({ username: user.name, avatar_url: user.image || null });
});

routes.post('/profile', express.json({ limit: '4kb' }), async (req, res) => {
    const user = res.locals.session?.user;
    if (!user) return void res.status(401).json({ error: 'Please sign in.' });
    const name = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    if (name.length < 3 || name.length > 15) return void res.status(400).json({ error: 'Username must be 3–15 characters.' });
    await auth.api.updateUser({ headers: fromNodeHeaders(req.headers), body: { name } });
    res.json({ username: name, avatar_url: user.image || null });
});

routes.get('/stats', async (_req, res) => {
    const user = res.locals.session?.user;
    if (!user) return void res.status(401).json({ error: 'Please sign in.' });
    // Lazy provisioning works for both email signup and optional Google login.
    await db.query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    const result = await db.query('SELECT * FROM user_stats WHERE user_id = $1', [user.id]);
    res.json(result.rows[0]);
});

routes.post('/avatar', express.raw({ type: 'image/*', limit: '2mb' }), async (req, res) => {
    const user = res.locals.session?.user;
    if (!user) return void res.status(401).json({ error: 'Please sign in.' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return void res.status(400).json({ error: 'Choose an image to upload.' });
    let image: Buffer;
    try {
        // Decode rather than trusting the supplied MIME type; bound decompression size.
        image = await sharp(req.body, { limitInputPixels: 16_000_000, animated: false })
            .rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
    } catch { return void res.status(400).json({ error: 'Please choose a valid PNG, JPEG, WebP, or GIF image.' }); }
    if (image.length > 262144) return void res.status(400).json({ error: 'Image is too large after resizing.' });
    const version = randomUUID();
    const url = `/api/avatars/${encodeURIComponent(user.id)}?v=${version}`;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO avatars (user_id, data, version) VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, version = EXCLUDED.version`, [user.id, image, version]);
        await client.query('UPDATE "user" SET image = $1, "updatedAt" = now() WHERE id = $2', [url, user.id]);
        await client.query('COMMIT');
        res.json({ avatar_url: url });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
});

routes.get('/avatars/:userId', async (req, res) => {
    const result = await db.query('SELECT data, content_type, version FROM avatars WHERE user_id = $1', [req.params.userId]);
    const avatar = result.rows[0];
    if (!avatar) return void res.sendStatus(404);
    const etag = `"${avatar.version}"`;
    res.set({ 'Content-Type': avatar.content_type, 'X-Content-Type-Options': 'nosniff', ETag: etag, 'Cache-Control': 'public, max-age=3600, must-revalidate' });
    if (req.get('if-none-match') === etag) return void res.sendStatus(304);
    res.send(avatar.data);
});

routes.post('/solo/questions', express.json({ limit: '4kb' }), async (req, res) => {
    const category = req.body?.category;
    const difficulty = req.body?.difficulty;
    if ((category !== undefined && typeof category !== 'string') || (difficulty !== undefined && typeof difficulty !== 'string')) {
        return void res.status(400).json({ error: 'Invalid question filters.' });
    }
    let questions;
    try { questions = await fetchQuestions(10, category, difficulty); }
    catch (error) { return void res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to fetch questions.' }); }
    const userId = res.locals.session?.user.id || null;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM solo_questions WHERE expires_at < now()');
        const publicQuestions = [];
        for (const q of questions) {
            const id = randomUUID();
            const token = randomBytes(32).toString('hex');
            const answers = shuffle([...q.incorrect_answers, q.correct_answer]);
            await client.query(`INSERT INTO solo_questions (id, user_id, guest_token_hash, difficulty, correct_answer, answers)
                VALUES ($1, $2, $3, $4, $5, $6)`, [id, userId, userId ? null : hashToken(token), q.difficulty, q.correct_answer, JSON.stringify(answers)]);
            publicQuestions.push({ id, token: userId ? undefined : token, question: q.question, category: q.category, difficulty: q.difficulty, all_answers: answers });
        }
        await client.query('COMMIT');
        res.json(publicQuestions);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
});

routes.post('/solo/answer', express.json({ limit: '8kb' }), async (req, res) => {
    const { id, answer, token } = req.body || {};
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || typeof answer !== 'string' || answer.length > 2000) {
        return void res.status(400).json({ error: 'Invalid answer.' });
    }
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT * FROM solo_questions WHERE id = $1 AND expires_at > now() FOR UPDATE', [id]);
        const question = result.rows[0];
        const allowed = question && (question.user_id ? question.user_id === res.locals.session?.user.id : typeof token === 'string' && hashToken(token) === question.guest_token_hash);
        if (!allowed) { await client.query('ROLLBACK'); return void res.status(404).json({ error: 'Question unavailable. Start a new game.' }); }
        if (!question.answers.includes(answer)) { await client.query('ROLLBACK'); return void res.status(400).json({ error: 'Choose one of the offered answers.' }); }
        // Retrying a response lost in transit returns the original result without counting twice.
        if (question.answered_at && question.selected_answer !== answer) { await client.query('ROLLBACK'); return void res.status(409).json({ error: 'This question was already answered.' }); }
        const correct = answer === question.correct_answer;
        if (!question.answered_at) {
            await client.query('UPDATE solo_questions SET answered_at = now(), selected_answer = $2 WHERE id = $1', [id, answer]);
            if (question.user_id) await recordQuestion(client, question.user_id, `solo:${id}`, 'solo', question.difficulty as Difficulty, correct);
        }
        await client.query('COMMIT');
        res.json({ correct, correctAnswer: question.correct_answer });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
});
