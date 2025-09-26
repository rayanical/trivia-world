// server.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Define types for our game state for better code quality
interface Player {
    id: string;
    name: string;
    score: number;
    // optional runtime fields
    lastAnswer?: string;
    lastAnswerTs?: number;
}

interface Game {
    players: Player[];
    host: string;
    // Game runtime state
    settings?: {
        category?: number;
        difficulty?: string;
        amount?: number;
    };
    currentQuestionIndex?: number;
    questions?: Question[];
    active?: boolean;
    timer?: NodeJS.Timeout | null;
    // when the current question is expected to end (ms since epoch)
    questionEndAt?: number | null;
    evaluating?: boolean;
}

type Question = {
    category?: string;
    type?: string;
    difficulty?: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
};

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000', // Your Next.js app URL
        methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
});

// In-memory storage for game states using a typed record
const games: Record<string, Game> = {};

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);
    try {
        // Log current connected sockets count for debugging
        // (io.sockets.sockets is a Map of socketId => Socket)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connectedCount = (io.sockets as any).sockets.size;
        console.log(`Connected clients: ${connectedCount}`);
    } catch {
        console.log('Connected clients: (could not determine)');
    }

    socket.on('create-game', (playerName: string) => {
        // Generate a simple, random 5-character game code
        const gameCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        socket.join(gameCode);

        games[gameCode] = {
            players: [{ id: socket.id, name: playerName, score: 0 }],
            host: socket.id,
        };

        console.log(`Game created: ${gameCode} by ${playerName} (${socket.id})`);
        console.log('Current games:', Object.keys(games).length);

        // Let the creator know the game was successfully created
        socket.emit('game-created', gameCode);
        // Broadcast the initial player list to the room (creator only right now)
        io.to(gameCode).emit('update-players', games[gameCode].players);
    });

    socket.on('join-game', ({ gameCode, playerName }: { gameCode: string; playerName: string }) => {
        const game = games[gameCode];
        console.log(`Join request for ${gameCode} by ${playerName} (${socket.id})`);
        if (game) {
            socket.join(gameCode);
            // Avoid adding the same socket twice
            const alreadyPresent = game.players.some((p) => p.id === socket.id);
            console.log(
                'Players before join:',
                game.players.map((p) => p.name),
            );
            if (!alreadyPresent) {
                game.players.push({ id: socket.id, name: playerName, score: 0 });
            }
            console.log(
                'Players after join:',
                game.players.map((p) => p.name),
            );

            // Notify everyone in the room about the updated player list
            io.to(gameCode).emit('update-players', game.players);

            // Confirm to the joining socket that join succeeded
            socket.emit('join-success', { gameCode });
        } else {
            socket.emit('join-error', 'Game not found. Please check the code.');
        }
    });

    // Allow clients to request the current player list for a game
    socket.on('get-players', (gameCode: string) => {
        const game = games[gameCode];
        if (game) {
            // Send the current players list to the requesting socket only
            socket.emit('update-players', game.players);
        } else {
            socket.emit('join-error', 'Game not found. Please check the code.');
        }
    });

    // Provide a lightweight snapshot to clients that ask for it (used for recovery)
    socket.on('get-state', (gameCode: string) => {
        const game = games[gameCode];
        if (!game) return socket.emit('join-error', 'Game not found.');

        const players = game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, answered: !!p.lastAnswer }));

        if (game.currentQuestionIndex !== undefined && game.questions && game.questions[game.currentQuestionIndex]) {
            const idx = game.currentQuestionIndex;
            const raw = game.questions[idx];
            const question = {
                index: idx,
                question: raw.question,
                difficulty: raw.difficulty,
                correct_answer: raw.correct_answer,
                incorrect_answers: raw.incorrect_answers,
                all_answers: [...raw.incorrect_answers, raw.correct_answer].sort(() => Math.random() - 0.5),
                timeLimit: 15,
                endTime: game.questionEndAt ?? Date.now() + 15000,
            };

            let remaining = 0;
            if (game.questionEndAt) {
                remaining = Math.max(0, Math.ceil((game.questionEndAt - Date.now()) / 1000));
            }

            socket.emit('state', { players, question, timeLeft: remaining });
        } else {
            socket.emit('state', { players });
        }
    });

    // You would add more events here, like "start-game", "submit-answer", etc.
    socket.on('start-game', async ({ gameCode, settings }: { gameCode: string; settings?: { category?: number; difficulty?: string; amount?: number } }) => {
        const game = games[gameCode];
        if (!game) return socket.emit('start-error', 'Game not found');
        if (game.host !== socket.id) return socket.emit('start-error', 'Only the host can start the game');

        // Persist settings
        game.settings = {
            category: settings?.category,
            difficulty: settings?.difficulty,
            amount: settings?.amount ?? 10,
        };

        // Fetch questions from OpenTDB
        try {
            const url = new URL('https://opentdb.com/api.php');
            url.searchParams.set('amount', String(game.settings.amount));
            url.searchParams.set('type', 'multiple');
            if (game.settings.category) url.searchParams.set('category', String(game.settings.category));
            if (game.settings.difficulty) url.searchParams.set('difficulty', String(game.settings.difficulty));

            const res = await fetch(url.toString());
            const json = await res.json();
            game.questions = json.results || [];
            game.currentQuestionIndex = 0;
            game.active = true;

            // Notify clients that game started and send first question
            io.to(gameCode).emit('game-started', { settings: game.settings });
            sendQuestion(gameCode);
        } catch (err) {
            console.error('Failed to fetch questions', err);
            socket.emit('start-error', 'Failed to fetch questions');
        }
    });

    // Players submit answers
    socket.on('submit-answer', ({ gameCode, answer, questionIndex }: { gameCode: string; answer: string; questionIndex: number }) => {
        const game = games[gameCode];
        if (!game || !game.active) return;

        // Ignore if this answer is for a stale (previous) question
        if (questionIndex !== game.currentQuestionIndex) return;

        // Record the player's answer on their player object for this question
        const player = game.players.find((p) => p.id === socket.id);
        if (!player) return;

        // Store temporary lastAnswer field (prevent re-submits)
        if (player.lastAnswer) return;
        player.lastAnswer = answer;
        // Optionally record timestamp for tiebreakers
        player.lastAnswerTs = Date.now();
        // Broadcast updated players so UI updates (e.g., show who answered)
        io.to(gameCode).emit(
            'update-players',
            game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, answered: !!p.lastAnswer })),
        );

        // If everyone has answered, evaluate immediately
        const allAnswered = game.players.every((p) => !!p.lastAnswer);
        if (allAnswered && !game.evaluating) {
            game.evaluating = true;
            // Notify clients that everyone has answered (don't reveal correct answer yet)
            io.to(gameCode).emit('all-answered', { players: game.players.map((p) => ({ id: p.id, name: p.name, answered: !!p.lastAnswer })) });

            // clear the current timeout that would have evaluated later
            if (game.timer) {
                clearTimeout(game.timer as NodeJS.Timeout);
                game.timer = null;
            }

            // Wait a short moment so clients can show "everyone answered" UI, then reveal
            setTimeout(() => {
                // Evaluate answers and award 1 point for correct
                const idx = game.currentQuestionIndex ?? 0;
                const raw = game.questions?.[idx];
                const correct = raw?.correct_answer;
                for (const p of game.players) {
                    const ans = p.lastAnswer;
                    if (ans && ans === correct) {
                        p.score += 1;
                    }
                    // Clear lastAnswer immediately after scoring
                    delete p.lastAnswer;
                    delete p.lastAnswerTs;
                }

                io.to(gameCode).emit('question-ended', {
                    correctAnswer: correct,
                    players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
                });

                // move to next question after 3s
                game.currentQuestionIndex = (game.currentQuestionIndex ?? 0) + 1;
                game.timer = setTimeout(() => {
                    game.evaluating = false;
                    sendQuestion(gameCode);
                }, 3000);
            }, 200);
        }
    });

    // Allow a player to leave the game voluntarily
    socket.on('leave-game', ({ gameCode }: { gameCode: string }) => {
        const game = games[gameCode];
        if (!game) return;
        const idx = game.players.findIndex((p) => p.id === socket.id);
        if (idx !== -1) {
            const removed = game.players.splice(idx, 1)[0];
            console.log(`Player ${removed.name} left game ${gameCode}`);
        }

        socket.leave(gameCode);

        if (game.players.length === 0) {
            delete games[gameCode];
            console.log(`Game ${gameCode} abandoned (no players left).`);
        } else {
            if (game.host === socket.id) {
                game.host = game.players[0].id;
                console.log(`Host left for game ${gameCode}, new host is ${game.players[0].name} (${game.host})`);
            }
            io.to(gameCode).emit('update-players', game.players);
        }
    });

    // Helper: send current question and start 15s timer
    const sendQuestion = (gameCode: string) => {
        const game = games[gameCode];
        if (!game || !game.questions) return;
        const idx = game.currentQuestionIndex ?? 0;
        const raw = game.questions[idx];
        if (!raw) {
            // No more questions -> end game
            endGame(gameCode);
            return;
        }

        // Prepare question payload
        const question = {
            index: idx,
            question: raw.question,
            difficulty: raw.difficulty,
            correct_answer: raw.correct_answer,
            incorrect_answers: raw.incorrect_answers,
            all_answers: [...raw.incorrect_answers, raw.correct_answer].sort(() => Math.random() - 0.5),
            timeLimit: 15,
            endTime: Date.now() + 15000,
        };

        // Clear previous last answers before sending new question
        for (const p of game.players) {
            delete p.lastAnswer;
            delete p.lastAnswerTs;
        }

        io.to(gameCode).emit('question', question);

        // record when this question will end (ms since epoch)
        game.questionEndAt = question.endTime;

        // Clear any existing timer
        if (game.timer) {
            clearTimeout(game.timer as NodeJS.Timeout);
            game.timer = null;
        }

        // Set timer for 15s to evaluate answers
        game.timer = setTimeout(() => {
            game.evaluating = true; // Set here to prevent races with late answers

            // Evaluate answers and award 1 point for correct
            const correct = raw.correct_answer;
            for (const p of game.players) {
                const ans = p.lastAnswer;
                if (ans && ans === correct) {
                    p.score += 1;
                }
                // Clear lastAnswer immediately after scoring
                delete p.lastAnswer;
                delete p.lastAnswerTs;
            }

            // clear questionEndAt since evaluation finished
            game.questionEndAt = null;

            // Broadcast final answers and updated scores
            io.to(gameCode).emit('question-ended', {
                correctAnswer: correct,
                players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
            });

            // Move to next question after short delay (3s)
            game.currentQuestionIndex = (game.currentQuestionIndex ?? 0) + 1;
            // If there are more questions, send next after 3s
            game.timer = setTimeout(() => {
                game.evaluating = false;
                sendQuestion(gameCode);
            }, 3000);
        }, 15000);
    };

    const endGame = (gameCode: string) => {
        const game = games[gameCode];
        if (!game) return;
        game.active = false;
        if (game.timer) {
            clearTimeout(game.timer as NodeJS.Timeout);
            game.timer = null;
        }

        // Emit final results
        io.to(gameCode).emit('game-over', { players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score })) });
    };

    socket.on('disconnect', (reason) => {
        console.log(`User Disconnected: ${socket.id} (${reason})`);

        // Remove this socket/player from any games they are in
        for (const [code, game] of Object.entries(games)) {
            const idx = game.players.findIndex((p) => p.id === socket.id);
            if (idx !== -1) {
                const removed = game.players.splice(idx, 1)[0];
                console.log(`Removed player ${removed.name} from game ${code}`);

                if (game.players.length === 0) {
                    // No players left: abandon the game
                    delete games[code];
                    console.log(`Game ${code} abandoned (no players left).`);
                } else {
                    // If host left, assign new host (first player)
                    if (game.host === socket.id) {
                        game.host = game.players[0].id;
                        console.log(`Host left for game ${code}, new host is ${game.players[0].name} (${game.host})`);
                    }
                    // Emit updated player list to remaining players
                    io.to(code).emit('update-players', game.players);
                }
            }
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Trivia server running on port ${PORT}`);
});
