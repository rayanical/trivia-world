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
    avatar?: string | null;
    // optional runtime fields
    lastAnswer?: string;
    lastAnswerTs?: number;
}

interface Game {
    players: Player[];
    host: string;
    // Game runtime state
    settings?: {
        category?: string;
        difficulty?: string;
        amount?: number;
        timeLimit?: number | null;
    };
    currentQuestionIndex?: number;
    questions?: Question[];
    active?: boolean;
    timer?: NodeJS.Timeout | null;
    // when the current question is expected to end (ms since epoch)
    questionEndAt?: number | null;
    evaluating?: boolean;
    currentAllAnswers?: string[];
}

type Question = {
    category?: string;
    type?: string;
    difficulty?: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
};

type TriviaApiQuestionResponse = {
    category: string;
    question: { text: string };
    difficulty: string;
    correctAnswer: string;
    incorrectAnswers: string[];
};

const app = express();
app.use(cors());
app.get('/', (req, res) => {
    res.send('Trivia World Backend is running!');
});
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
});
// In-memory storage for game states using a typed record
const games: Record<string, Game> = {};

/**
 * Establishes per-socket handlers for multiplayer trivia gameplay coordination.
 * @param socket - Connected Socket.IO client instance.
 */
io.on('connection', (socket) => {
    /**
     * Socket.io event: Creates a new multiplayer trivia game.
     * @event create-game
     * @param player - Initial player payload containing name and avatar URL.
     * @emits game-created - Returns the generated lobby code to the host.
     * @emits update-players - Shares the initial player roster with the room.
     */
    socket.on('create-game', (player: { name: string; avatar: string | null }) => {
        const gameCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        socket.join(gameCode);

        games[gameCode] = {
            players: [{ id: socket.id, name: player.name, score: 0, avatar: player.avatar }],
            host: socket.id,
        };

        // Let the creator know the game was successfully created
        socket.emit('game-created', gameCode);
        // Broadcast the initial player list to the room (creator only right now)
        io.to(gameCode).emit('update-players', games[gameCode].players);
    });

    /**
     * Socket.io event: Allows a player to join an existing multiplayer lobby.
     * @event join-game
     * @param payload.gameCode - Target lobby identifier provided by the client.
     * @param payload.player - Joining player's display name and avatar URL.
     * @emits update-players - Shares the refreshed roster with lobby members.
     * @emits join-success - Confirms successful entry to the requesting client.
     * @emits join-error - Indicates that the requested lobby does not exist.
     */
    socket.on('join-game', ({ gameCode, player }: { gameCode: string; player: { name: string; avatar: string | null } }) => {
        const game = games[gameCode];
        if (game) {
            socket.join(gameCode);
            // Avoid adding the same socket twice
            const alreadyPresent = game.players.some((p) => p.id === socket.id);
            if (!alreadyPresent) {
                game.players.push({ id: socket.id, name: player.name, score: 0, avatar: player.avatar });
            }

            // Notify everyone in the room about the updated player list
            io.to(gameCode).emit('update-players', game.players);

            // Confirm to the joining socket that join succeeded
            socket.emit('join-success', { gameCode });
        } else {
            socket.emit('join-error', 'Game not found. Please check the code.');
        }
    });

    // Allow clients to request the current player list for a game
    /**
     * Socket.io event: Returns the current roster for a given lobby.
     * @event get-players
     * @param gameCode - The lobby code whose player list is requested.
     * @emits update-players - Responds with the latest player data for the caller.
     * @emits join-error - Sent when the lobby cannot be found.
     */
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
    /**
     * Socket.io event: Provides a snapshot of game state for reconnecting clients.
     * @event get-state
     * @param gameCode - The lobby code whose state should be synchronized.
     * @emits state - Returns players, question data, and remaining time.
     * @emits join-error - Indicates that the lobby no longer exists.
     */
    socket.on('get-state', (gameCode: string) => {
        const game = games[gameCode];
        if (!game) return socket.emit('join-error', 'Game not found.');

        const players = game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, answered: !!p.lastAnswer, avatar: p.avatar }));

        const player = game.players.find((p) => p.id === socket.id);
        const myAnswer = player?.lastAnswer;

        // Don't send question state during evaluation/transition period
        if (game.evaluating) {
            socket.emit('state', { players });
            return;
        }

        if (game.currentQuestionIndex !== undefined && game.questions && game.questions[game.currentQuestionIndex]) {
            const idx = game.currentQuestionIndex;
            const raw = game.questions[idx];
            const all_answers = game.currentAllAnswers ?? [...raw.incorrect_answers, raw.correct_answer].sort(() => Math.random() - 0.5);
            const timeLimitSetting = game.settings?.timeLimit;
            const timeLimit = typeof timeLimitSetting === 'number' && timeLimitSetting > 0 ? timeLimitSetting : null;
            const endTime = game.questionEndAt ?? (timeLimit ? Date.now() + timeLimit * 1000 : null);
            const question = {
                index: idx,
                question: raw.question,
                category: raw.category,
                difficulty: raw.difficulty,
                correct_answer: raw.correct_answer,
                incorrect_answers: raw.incorrect_answers,
                all_answers,
                timeLimit,
                endTime,
            };

            let remaining = 0;
            if (game.questionEndAt) {
                remaining = Math.max(0, Math.ceil((game.questionEndAt - Date.now()) / 1000));
            }
            socket.emit('state', { players, question, timeLeft: game.questionEndAt ? remaining : null, myAnswer });
        } else {
            socket.emit('state', { players });
        }
    });
    // You would add more events here, like "start-game", "submit-answer", etc.
    /**
     * Socket.io event: Begins a multiplayer trivia match using the provided settings.
     * @event start-game
     * @param payload.gameCode - Lobby code for the match to start.
     * @param payload.settings - Host-selected category, difficulty, question count, and timer.
     * @emits start-error - Signals problems such as missing lobby or unauthorized host.
     * @emits game-started - Broadcasts applied settings to all players.
     * @emits question - Sends the first formatted question to the lobby.
     */
    socket.on('start-game', async ({ gameCode, settings }: { gameCode: string; settings?: { category?: string; difficulty?: string; amount?: number; timeLimit?: number | null } }) => {
        const game = games[gameCode];
        if (!game) return socket.emit('start-error', 'Game not found');
        if (game.host !== socket.id) return socket.emit('start-error', 'Only the host can start the game');

        // Persist settings
        game.settings = {
            category: settings?.category,
            difficulty: settings?.difficulty,
            amount: settings?.amount ?? 10,
            timeLimit: settings?.timeLimit === undefined ? 15 : settings.timeLimit,
        };

        // Fetch questions from The Trivia API
        try {
            let apiUrl = `https://the-trivia-api.com/v2/questions?limit=${game.settings.amount}`;

            if (game.settings.category) {
                apiUrl += `&categories=${game.settings.category}`;
            }

            if (game.settings.difficulty) {
                apiUrl += `&difficulties=${game.settings.difficulty}`;
            }

            const res = await fetch(apiUrl);
            const data = (await res.json()) as TriviaApiQuestionResponse[];
            // Format questions to match internal structure
            game.questions = data.map((q) => ({
                category: q.category,
                question: q.question.text,
                difficulty: q.difficulty,
                correct_answer: q.correctAnswer,
                incorrect_answers: q.incorrectAnswers,
            }));
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
    /**
     * Socket.io event: Registers a player's answer for the active question.
     * @event submit-answer
     * @param payload.gameCode - Lobby code for the current match.
     * @param payload.answer - Answer text selected by the player.
     * @param payload.questionIndex - Index of the question the answer belongs to.
     * @emits update-players - Reflects which participants have responded.
     * @emits all-answered - Signals when every player has submitted an answer.
     * @emits question-ended - Reveals correct answers after evaluation.
     */
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
            game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, answered: !!p.lastAnswer, avatar: p.avatar })),
        );

        // If everyone has answered, evaluate immediately
        const allAnswered = game.players.every((p) => !!p.lastAnswer);
        if (allAnswered && !game.evaluating) {
            game.evaluating = true;
            // Notify clients that everyone has answered (don't reveal correct answer yet)
            io.to(gameCode).emit('all-answered', { players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, answered: !!p.lastAnswer, avatar: p.avatar })) });

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

                const transitionEnd = Date.now() + 3000;
                /**
                 * Socket.io event: Reveals the correct answer and updated scores after evaluation.
                 * @event question-ended
                 * @param payload.correctAnswer - The authoritative answer for the completed question.
                 * @param payload.players - Player list augmented with latest scores.
                 * @param payload.transitionEnd - Timestamp signaling when the reveal phase finishes.
                 */
                io.to(gameCode).emit('question-ended', {
                    correctAnswer: correct,
                    players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, avatar: p.avatar })),
                    transitionEnd,
                });
                delete game.currentAllAnswers;
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
    /**
     * Socket.io event: Removes a player from the lobby and reassigns host when needed.
     * @event leave-game
     * @param payload.gameCode - Lobby code the player wishes to exit.
     * @emits update-players - Broadcasts the new roster after removal.
     */
    socket.on('leave-game', ({ gameCode }: { gameCode: string }) => {
        const game = games[gameCode];
        if (!game) return;
        const idx = game.players.findIndex((p) => p.id === socket.id);
        if (idx !== -1) {
            game.players.splice(idx, 1);
        }

        socket.leave(gameCode);

        if (game.players.length === 0) {
            delete games[gameCode];
        } else {
            if (game.host === socket.id) {
                game.host = game.players[0].id;
            }
            io.to(gameCode).emit('update-players', game.players);
        }
    });

    /**
     * Emits the next trivia question and starts any associated countdown timers.
     * @param gameCode - Lobby code whose participants should receive the question.
     * @emits question - Sends formatted question data to every player in the lobby.
     */
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
        const all_answers = [...raw.incorrect_answers, raw.correct_answer].sort(() => Math.random() - 0.5);
        game.currentAllAnswers = all_answers; // Store for resync consistency
        const timeLimitSetting = game.settings?.timeLimit;
        const timeLimit = typeof timeLimitSetting === 'number' && timeLimitSetting > 0 ? timeLimitSetting : null;
        const endTime = timeLimit ? Date.now() + timeLimit * 1000 : null;
        const question = {
            index: idx,
            question: raw.question,
            category: raw.category,
            difficulty: raw.difficulty,
            correct_answer: raw.correct_answer,
            incorrect_answers: raw.incorrect_answers,
            all_answers,
            timeLimit,
            endTime,
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

        // Set timer only if timeLimit exists
        if (timeLimit) {
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
                const transitionEnd = Date.now() + 3000;
                io.to(gameCode).emit('question-ended', {
                    correctAnswer: correct,
                    players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, avatar: p.avatar })),
                    transitionEnd,
                });
                delete game.currentAllAnswers;
                // Move to next question after short delay (3s)
                game.currentQuestionIndex = (game.currentQuestionIndex ?? 0) + 1;
                // If there are more questions, send next after 3s
                game.timer = setTimeout(() => {
                    game.evaluating = false;
                    sendQuestion(gameCode);
                }, 3000);
            }, timeLimit * 1000);
        } else {
            game.timer = null;
            game.questionEndAt = null;
        }
    };

    /**
     * Finalizes the match, clears timers, and shares the concluding leaderboard.
     * @param gameCode - Lobby code whose game lifecycle is ending.
     * @emits game-over - Broadcasts final player standings to all participants.
     */
    const endGame = (gameCode: string) => {
        const game = games[gameCode];
        if (!game) return;
        game.active = false;
        if (game.timer) {
            clearTimeout(game.timer as NodeJS.Timeout);
            game.timer = null;
        }

        // Emit final results
        /**
         * Socket.io event: Announces the final leaderboard and concludes the match.
         * @event game-over
         * @param payload.players - Player standings with final scores and avatars.
         */
        io.to(gameCode).emit('game-over', { players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score, avatar: p.avatar })) });
        delete game.currentAllAnswers;
    };

    /**
     * Socket.io event: Cleans up player state when a socket disconnects unexpectedly.
     * @event disconnect
     * @param reason - Description supplied by Socket.IO for the disconnect.
     */
    socket.on('disconnect', () => {
        // Remove this socket/player from any games they are in
        for (const [code, game] of Object.entries(games)) {
            const idx = game.players.findIndex((p) => p.id === socket.id);
            if (idx !== -1) {
                game.players.splice(idx, 1);

                if (game.players.length === 0) {
                    // No players left: abandon the game
                    delete games[code];
                } else {
                    // If host left, assign new host (first player)
                    if (game.host === socket.id) {
                        game.host = game.players[0].id;
                    }
                    // Emit updated player list to remaining players
                    io.to(code).emit('update-players', game.players);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.info(`🚀 Trivia server running on port ${PORT}`);
});
