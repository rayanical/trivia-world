import express from 'express';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import cors from 'cors';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { auth } from './src/server/auth';
import { db } from './src/server/db';
import { trustedOrigins } from './src/server/config';
import { routes } from './src/server/routes';
import { fetchQuestions, shuffle, type Question } from './src/server/trivia';
import { recordGame, recordQuestion } from './src/server/stats';
import { verifiedClientIp } from './src/lib/proxy-ip';

interface Player {
    id: string;
    key: string;
    userId?: string;
    name: string;
    avatar: string | null;
    score: number;
    lastAnswer?: string;
    disconnected?: boolean;
    removalTimer?: ReturnType<typeof setTimeout>;
}
interface Settings { category?: string; difficulty?: string; amount: number; timeLimit: number | null }
interface Game {
    id: string;
    players: Player[];
    host: string;
    settings?: Settings;
    questions?: Question[];
    index: number;
    phase: 'lobby' | 'loading' | 'question' | 'reveal' | 'finished';
    answers: string[];
    endAt: number | null;
    correctAnswer?: string;
    transitionEnd?: number;
    timer?: ReturnType<typeof setTimeout>;
}

const app = express();
app.use((req, res, next) => {
    const ip = verifiedClientIp(fromNodeHeaders(req.headers), process.env.PROXY_SHARED_SECRET) || req.socket.remoteAddress;
    // Overwrite unsigned input even for clients reaching Render directly.
    if (ip) req.headers['x-trivia-client-ip'] = ip;
    else delete req.headers['x-trivia-client-ip'];
    res.locals.clientIp = ip;
    next();
});
app.use(cors({ origin: trustedOrigins, credentials: true }));
app.all('/api/auth/*splat', toNodeHandler(auth));
app.use('/api', routes);
app.get('/', (_req, res) => res.send('Trivia World Backend is running!'));
app.get('/health', async (_req, res) => {
    try { await db.query('SELECT 1'); res.json({ ok: true }); }
    catch { res.status(503).json({ ok: false }); }
});
app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next; // Express recognizes an error handler by its four arguments.
    const status = error.status || 500;
    if (status >= 500) console.error('Request failed', error.message);
    res.status(status).json({ error: status === 413 ? 'File is too large. Maximum upload size is 2 MB.' : 'Request failed. Please try again.' });
});
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: trustedOrigins, credentials: true },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || trustedOrigins.includes(req.headers.origin)),
    pingTimeout: 60_000,
    maxHttpBufferSize: 16_384,
});
const games = new Map<string, Game>();
const publicPlayers = (game: Game) => game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, avatar: p.avatar, answered: Boolean(p.lastAnswer), disconnected: Boolean(p.disconnected) }));
const pendingStats = new Set<Promise<void>>();

function persist(game: Game, write: () => Promise<void>) {
    const job = (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            try { await write(); return; }
            catch (error) {
                if (attempt === 2) {
                    console.error('Could not save game statistics', error instanceof Error ? error.message : 'Database error');
                    io.to(findCode(game)).emit('stats-error', 'Some statistics could not be saved.');
                } else await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    })();
    pendingStats.add(job);
    void job.finally(() => pendingStats.delete(job));
}
function findCode(game: Game) { return [...games].find(([, value]) => value === game)?.[0] || ''; }
function broadcast(code: string, game: Game) { io.to(code).emit('update-players', publicPlayers(game)); }
function destroyGame(code: string, game: Game) {
    clearTimeout(game.timer);
    for (const player of game.players) clearTimeout(player.removalTimer);
    games.delete(code);
}
function removePlayer(code: string, game: Game, key: string) {
    const player = game.players.find((p) => p.key === key);
    if (!player) return;
    clearTimeout(player.removalTimer);
    game.players = game.players.filter((p) => p !== player);
    if (!game.players.length) return destroyGame(code, game);
    if (game.host === player.id) game.host = game.players[0].id;
    broadcast(code, game);
    if (game.phase === 'question' && game.players.every((p) => p.disconnected || p.lastAnswer)) evaluate(code, game);
}
function sendQuestion(code: string, game: Game) {
    if (games.get(code) !== game) return;
    const question = game.questions?.[game.index];
    if (!question) {
        game.phase = 'finished';
        game.endAt = null;
        const max = Math.max(...game.players.map((p) => p.score));
        for (const player of game.players) if (player.userId) {
            persist(game, () => recordGame(db, player.userId!, `game:${game.id}`, player.score === max));
        }
        io.to(code).emit('game-over', { players: publicPlayers(game) });
        return;
    }
    game.phase = 'question';
    game.correctAnswer = undefined;
    game.transitionEnd = undefined;
    game.answers = shuffle([...question.incorrect_answers, question.correct_answer]);
    for (const player of game.players) delete player.lastAnswer;
    broadcast(code, game);
    game.endAt = game.settings?.timeLimit ? Date.now() + game.settings.timeLimit * 1000 : null;
    io.to(code).emit('question', publicQuestion(game));
    clearTimeout(game.timer);
    if (game.endAt) game.timer = setTimeout(() => evaluate(code, game), game.endAt - Date.now());
}
function publicQuestion(game: Game) {
    const question = game.questions![game.index];
    return { index: game.index, question: question.question, category: question.category, difficulty: question.difficulty,
        all_answers: game.answers, timeLimit: game.settings?.timeLimit, endTime: game.endAt };
}
function evaluate(code: string, game: Game) {
    if (games.get(code) !== game || game.phase !== 'question') return;
    clearTimeout(game.timer);
    game.phase = 'reveal';
    const question = game.questions![game.index];
    for (const player of game.players) {
        const correct = player.lastAnswer === question.correct_answer;
        if (correct) player.score++;
        if (player.userId && player.lastAnswer) {
            const userId = player.userId;
            const eventId = `question:${game.id}:${game.index}`;
            persist(game, () => recordQuestion(db, userId, eventId, 'multiplayer', question.difficulty, correct));
        }
    }
    game.correctAnswer = question.correct_answer;
    game.endAt = null;
    game.transitionEnd = Date.now() + 3000;
    io.to(code).emit('question-ended', { correctAnswer: game.correctAnswer, players: publicPlayers(game), transitionEnd: game.transitionEnd });
    game.timer = setTimeout(() => { game.index++; sendQuestion(code, game); }, 3000);
}

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (token !== undefined && typeof token !== 'string') return next(new Error('Invalid session.'));
        const session = token ? await auth.api.getSession({ headers: new Headers({ Authorization: `Bearer ${token}` }) }) : null;
        if (token && !session) return next(new Error('Your session expired. Please sign in again.'));
        socket.data.user = session?.user;
        const guestId = socket.handshake.auth?.guestId;
        socket.data.key = session ? `user:${session.user.id}` : `guest:${typeof guestId === 'string' && /^[0-9a-f-]{36}$/i.test(guestId) ? guestId : randomUUID()}`;
        next();
    } catch { next(new Error('Unable to verify your session. Please reconnect.')); }
});

function restorePlayer(socket: Socket, game: Game, code: string) {
    const player = game.players.find((p) => p.key === socket.data.key);
    if (!player) return;
    if (player.id !== socket.id) {
        const oldSocket = io.sockets.sockets.get(player.id);
        if (oldSocket) { oldSocket.leave(code); oldSocket.emit('join-error', 'Your player joined from another connection.'); }
        if (game.host === player.id) game.host = socket.id;
        player.id = socket.id;
    }
    clearTimeout(player.removalTimer);
    player.disconnected = false;
    socket.join(code);
    return player;
}

io.on('connection', (socket) => {
    let events = 0;
    let windowStart = Date.now();
    socket.use((_packet, next) => {
        if (Date.now() - windowStart > 60_000) { events = 0; windowStart = Date.now(); }
        next(++events > 180 ? new Error('Too many requests.') : undefined);
    });
    const makePlayer = (payload: unknown): Player | null => {
        const user = socket.data.user;
        const name = user?.name || (payload && typeof payload === 'object' && 'name' in payload && typeof payload.name === 'string' ? payload.name.trim() : '');
        if (!name || name.length > 100) return null;
        return { id: socket.id, key: socket.data.key, userId: user?.id, name: name.slice(0, 15), avatar: user?.image || null, score: 0 };
    };
    socket.on('create-game', (payload: unknown) => {
        const player = makePlayer(payload);
        if (!player) return socket.emit('join-error', 'Choose a player name.');
        if ([...games.values()].filter((g) => g.players.some((p) => p.key === player.key)).length >= 3 || games.size >= 1000) return socket.emit('join-error', 'Too many active lobbies. Leave an existing lobby first.');
        let code: string;
        do { code = randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase(); } while (games.has(code));
        const game: Game = { id: randomUUID(), players: [player], host: socket.id, index: 0, phase: 'lobby', answers: [], endAt: null };
        games.set(code, game);
        socket.join(code);
        socket.emit('game-created', code);
        broadcast(code, game);
    });
    socket.on('join-game', (payload) => {
        const code = payload?.gameCode;
        const game = typeof code === 'string' ? games.get(code) : undefined;
        if (!game) return socket.emit('join-error', 'Game not found. Please check the code.');
        if (!restorePlayer(socket, game, code)) {
            if (game.players.length >= 8 || !['lobby', 'finished'].includes(game.phase)) return socket.emit('join-error', 'This lobby is full or the game has already started.');
            const player = makePlayer(payload.player);
            if (!player) return socket.emit('join-error', 'Choose a player name.');
            game.players.push(player);
            socket.join(code);
        }
        broadcast(code, game);
        socket.emit('join-success', { gameCode: code });
    });
    socket.on('get-players', (code) => {
        const game = typeof code === 'string' ? games.get(code) : undefined;
        if (!game) return socket.emit('join-error', 'Game not found.');
        if (!restorePlayer(socket, game, code)) return;
        broadcast(code, game);
    });
    socket.on('get-state', (code) => {
        const game = typeof code === 'string' ? games.get(code) : undefined;
        if (!game) return socket.emit('join-error', 'Game not found.');
        const player = restorePlayer(socket, game, code);
        if (!player) return;
        socket.emit('state', { phase: game.phase, host: game.host, settings: game.settings, players: publicPlayers(game), question: ['question', 'reveal'].includes(game.phase) ? publicQuestion(game) : undefined,
            timeLeft: game.endAt ? Math.max(0, Math.ceil((game.endAt - Date.now()) / 1000)) : null, myAnswer: player.lastAnswer });
        if (game.phase === 'reveal') socket.emit('question-ended', { correctAnswer: game.correctAnswer, players: publicPlayers(game), transitionEnd: game.transitionEnd });
        if (game.phase === 'finished') socket.emit('game-over', { players: publicPlayers(game) });
    });
    socket.on('start-game', async (payload) => {
        const code = payload?.gameCode;
        const game = typeof code === 'string' ? games.get(code) : undefined;
        if (!game || game.host !== socket.id) return socket.emit('start-error', 'Only the host can start an existing game.');
        if (!['lobby', 'finished'].includes(game.phase)) return socket.emit('start-error', 'A game is already running.');
        const settings = payload.settings || {};
        const timeLimit = settings.timeLimit === undefined ? 15 : settings.timeLimit;
        if (timeLimit !== null && (!Number.isInteger(timeLimit) || timeLimit < 5 || timeLimit > 120)) return socket.emit('start-error', 'Time limit must be 5–120 seconds.');
        game.phase = 'loading';
        try {
            const questions = await fetchQuestions(settings.amount ?? 10, settings.category, settings.difficulty);
            if (games.get(code) !== game) return;
            game.id = randomUUID();
            game.settings = { ...settings, amount: settings.amount ?? 10, timeLimit };
            game.questions = questions;
            game.index = 0;
            for (const player of game.players) player.score = 0;
            io.to(code).emit('game-started', { settings: game.settings });
            sendQuestion(code, game);
        } catch (error) {
            game.phase = 'lobby';
            socket.emit('start-error', error instanceof Error ? error.message : 'Failed to fetch questions.');
        }
    });
    socket.on('submit-answer', (payload) => {
        const code = payload?.gameCode;
        const game = typeof code === 'string' ? games.get(code) : undefined;
        if (!game || game.phase !== 'question' || payload.questionIndex !== game.index) return;
        if (game.endAt && Date.now() >= game.endAt) return evaluate(code, game);
        const player = game.players.find((p) => p.id === socket.id && p.key === socket.data.key);
        if (!player || player.lastAnswer || !game.answers.includes(payload.answer)) return;
        player.lastAnswer = payload.answer;
        broadcast(code, game);
        if (game.players.every((p) => p.disconnected || p.lastAnswer)) {
            io.to(code).emit('all-answered', { players: publicPlayers(game) });
            evaluate(code, game);
        }
    });
    socket.on('leave-game', (payload) => {
        const code = payload?.gameCode;
        const game = typeof code === 'string' ? games.get(code) : undefined;
        if (!game || !game.players.some((p) => p.id === socket.id)) return;
        socket.leave(code);
        removePlayer(code, game, socket.data.key);
    });
    socket.on('disconnect', () => {
        for (const [code, game] of games) {
            const player = game.players.find((p) => p.id === socket.id);
            if (!player) continue;
            player.disconnected = true;
            player.removalTimer = setTimeout(() => removePlayer(code, game, player.key), 30_000);
            broadcast(code, game);
        }
    });
});

server.listen(process.env.PORT || 3001, () => console.info('Trivia server is listening.'));
export async function stopServer() {
    for (const [code, game] of games) destroyGame(code, game);
    io.close();
    server.close();
    await Promise.allSettled(pendingStats);
    await db.end();
}
process.once('SIGTERM', () => { void stopServer().then(() => process.exit(0)); });
process.once('SIGINT', () => { void stopServer().then(() => process.exit(0)); });
