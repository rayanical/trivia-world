'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAlert } from '@/context/AlertContext';
import { socket } from '@/lib/socket';
import { requestLobby } from '@/lib/lobby-request';
import { useAuth } from '@/context/AuthContext';
type PlayerView = { id?: string; name: string; score?: number; answered?: boolean; avatar?: string | null };

type Question = {
    index?: number;
    question: string;
    category?: string;
    difficulty?: string;
    correct_answer?: string;
    incorrect_answers?: string[];
    all_answers?: string[];
    timeLimit?: number | null;
    endTime?: number | null;
};

export function useLobbyGame() {
    const params = useParams();
    const router = useRouter();
    const gameCode = typeof params.gameCode === 'string' ? params.gameCode : '';
    const [players, setPlayers] = useState<PlayerView[]>([]);
    const [joined, setJoined] = useState(false);
    const [guestName, setGuestName] = useState('');

    useEffect(() => {
        setJoined(sessionStorage.getItem('joinedLobby') === gameCode);
        setGuestName(sessionStorage.getItem('playerName') || '');
        return () => { joinRequest.current?.abort(); };
    }, [gameCode]);
    const [joining, setJoining] = useState(false);
    const joinRequest = useRef<AbortController | null>(null);
    const autoJoinAttempted = useRef(false);

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const { user, profile, multiplayerConnected, requireServer } = useAuth();
    const { showAlert } = useAlert();
    const [category, setCategory] = useState<string>('');
    const [difficulty, setDifficulty] = useState<string>('');
    const [amount, setAmount] = useState('10');
    const [isTimeLimitEnabled, setIsTimeLimitEnabled] = useState<boolean>(true);
    const [timeLimit, setTimeLimit] = useState('15');
    const [inGame, setInGame] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isRevealPhase, setIsRevealPhase] = useState(false);
    const timerRef = useRef<number | null>(null);
    const revealTimerRef = useRef<number | null>(null);
    const recoveryTimerRef = useRef<number | null>(null);


    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
    const [everyoneAnswered, setEveryoneAnswered] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const winners = useMemo(() => {
        const max = Math.max(...players.map(p => p.score || 0));
        return players.filter(p => (p.score || 0) === max);
    }, [players]);
    const [starting, setStarting] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const maxPlayers = 8;

    /**
     * Converts trivia API category tokens into user-friendly display names.
     * @param apiCategory - Category identifier received from the backend or API.
     * @returns Normalized category label for presentation in the UI.
     */
    useEffect(() => {
        const currentPlayerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') : null;
        if (currentPlayerName && currentPlayerName.length > 15) {
            const truncatedName = currentPlayerName.substring(0, 15);
            sessionStorage.setItem('playerName', truncatedName);
        }
    }, []);

    const joinLobby = useCallback(async () => {
        if (joinRequest.current || !requireServer(true)) return;
        const name = profile?.username?.trim() || guestName.trim();
        if (!name) return;
        const controller = new AbortController();
        joinRequest.current = controller;
        setJoining(true);
        try {
            await requestLobby('join-game', { gameCode, player: { name, avatar: profile?.avatar_url || null } }, controller.signal);
            sessionStorage.setItem('playerName', name);
            sessionStorage.setItem('joinedLobby', gameCode);
            setJoined(true);
            socket.emit('get-state', gameCode);
        } catch (error) {
            if (!controller.signal.aborted) {
                setJoined(false);
                showAlert(error instanceof Error ? error.message : 'Could not join the lobby.');
            }
        } finally {
            if (!controller.signal.aborted) setJoining(false);
            joinRequest.current = null;
        }
    }, [gameCode, profile, guestName, requireServer, showAlert]);

    useEffect(() => {
        if (!multiplayerConnected) { autoJoinAttempted.current = false; return; }
        if (user && !joined && !autoJoinAttempted.current) {
            autoJoinAttempted.current = true;
            void joinLobby();
        }
    }, [multiplayerConnected, user, joined, joinLobby]);

    useEffect(() => {
        const onUpdate = (list: PlayerView[]) => {
            setPlayers(list);
            if (list.some(p => p.id === socket.id)) setJoined(true);
        };
        const onQuestion = (q: Question) => {
            if (recoveryTimerRef.current) {
                window.clearTimeout(recoveryTimerRef.current);
                recoveryTimerRef.current = null;
            }
            if (revealTimerRef.current) {
                window.clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
            }
            setSelectedAnswer(null);
            setRevealedAnswer(null);
            setIsTransitioning(false);
            setIsRevealPhase(false);
            setShowGameOver(false);
            setInGame(true);
            setCurrentQuestion(q);
            setTimeLeft(q.endTime ? Math.max(0, Math.ceil((q.endTime - Date.now()) / 1000)) : 0);
        };
        const onState = (payload: { players?: PlayerView[]; question?: Question; timeLeft?: number; myAnswer?: string; phase?: string; settings?: { category?: string; difficulty?: string; amount: number; timeLimit: number | null } }) => {
            if (payload.players) onUpdate(payload.players);
            if (payload.phase) setStarting(payload.phase === 'loading');
            if (payload.phase !== 'reveal' && revealTimerRef.current) {
                window.clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
            }
            if (payload.settings && ['loading', 'question', 'reveal'].includes(payload.phase || '')) {
                setCategory(payload.settings.category || ''); setDifficulty(payload.settings.difficulty || '');
                setAmount(String(payload.settings.amount)); setIsTimeLimitEnabled(payload.settings.timeLimit !== null);
                setTimeLimit(String(payload.settings.timeLimit || 15));
            }
            if (payload.phase === 'lobby' || payload.phase === 'loading') { setInGame(false); setShowGameOver(false); setCurrentQuestion(null); }
            if (payload.question) {
                if (recoveryTimerRef.current) {
                    window.clearTimeout(recoveryTimerRef.current);
                    recoveryTimerRef.current = null;
                }
                setIsRevealPhase(payload.phase === 'reveal');
                setIsTransitioning(payload.phase === 'reveal');
                if (payload.phase !== 'reveal') setRevealedAnswer(null);
                setShowGameOver(false);
                setInGame(true);
                setCurrentQuestion(payload.question);
                setTimeLeft(payload.question.endTime ? Math.max(0, Math.ceil((payload.question.endTime - Date.now()) / 1000)) : 0);
                setSelectedAnswer(payload.myAnswer ?? null);
            }
        };
        const onQuestionEnded = async (payload: { players?: PlayerView[]; correctAnswer?: string; transitionEnd?: number }) => {
            setPlayers(payload.players || []);
            setRevealedAnswer(payload.correctAnswer ?? null);
            setIsRevealPhase(true);
            setIsTransitioning(true);
            setEveryoneAnswered(false);

            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }

            if (revealTimerRef.current) {
                window.clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
            }

            if (recoveryTimerRef.current) {
                window.clearTimeout(recoveryTimerRef.current);
                recoveryTimerRef.current = null;
            }

            const transitionEnd = payload.transitionEnd;
            const remaining = transitionEnd ? Math.max(0, Math.ceil((transitionEnd - Date.now()) / 1000)) : 3;
            setTimeLeft(remaining);

            if (remaining > 0) {
                const endsAt = transitionEnd ?? Date.now() + remaining * 1000;
                revealTimerRef.current = window.setInterval(() => {
                    const curr = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
                    setTimeLeft(curr);
                    if (curr <= 0) {
                        if (revealTimerRef.current) window.clearInterval(revealTimerRef.current);
                        revealTimerRef.current = null;
                        setCurrentQuestion(null);
                        setTimeLeft(0);
                        setRevealedAnswer(null);
                        setEveryoneAnswered(false);
                        setIsTransitioning(false);
                        setIsRevealPhase(false);
                    }
                }, 1000) as unknown as number;
            } else {
                if (revealTimerRef.current) {
                    window.clearInterval(revealTimerRef.current);
                    revealTimerRef.current = null;
                }
                setCurrentQuestion(null);
                setTimeLeft(0);
                setRevealedAnswer(null);
                setEveryoneAnswered(false);
                setIsTransitioning(false);
                setIsRevealPhase(false);
            }

            recoveryTimerRef.current = window.setTimeout(() => {
                if (gameCode) socket.emit('get-state', gameCode);
                recoveryTimerRef.current = null;
            }, 5000) as unknown as number;


        };
        const onAllAnswered = (payload: { players?: PlayerView[] }) => {
            setPlayers(payload.players || []);
            setEveryoneAnswered(true);
        };
        const onGameOver = async (payload: { players?: PlayerView[] }) => {
            setPlayers(payload.players || []);
            setInGame(false);
            setCurrentQuestion(null);
            setShowGameOver(true);
            setStarting(false);
            if (recoveryTimerRef.current) { window.clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; }
            setTimeLeft(0);
            setSelectedAnswer(null);
            setRevealedAnswer(null);
            setIsRevealPhase(false);

            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (revealTimerRef.current) {
                window.clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
            }


        };

        const onError = (message: string) => { setStarting(false); showAlert(message, 'error'); };
        const onJoinError = (message: string) => {
            setJoined(false); sessionStorage.removeItem('joinedLobby');
            if (!joinRequest.current) showAlert(message, 'error');
        };
        const onStarted = () => setStarting(false);
        const onConnectionError = (error: Error) => showAlert(error.message, 'error');
        socket.on('start-error', onError);
        socket.on('join-error', onJoinError);
        socket.on('game-started', onStarted);
        socket.on('stats-error', onError);
        socket.on('connect_error', onConnectionError);
        socket.on('update-players', onUpdate);
        socket.on('state', onState);
        socket.on('question', onQuestion);
        socket.on('all-answered', onAllAnswered);
        socket.on('question-ended', onQuestionEnded);
        socket.on('game-over', onGameOver);

        return () => {
            socket.off('start-error', onError);
            socket.off('join-error', onJoinError);
            socket.off('game-started', onStarted);
            socket.off('stats-error', onError);
            socket.off('connect_error', onConnectionError);
            socket.off('update-players', onUpdate);
            socket.off('state', onState);
            socket.off('question', onQuestion);
            socket.off('all-answered', onAllAnswered);
            socket.off('question-ended', onQuestionEnded);
            socket.off('game-over', onGameOver);

            if (recoveryTimerRef.current) {
                window.clearTimeout(recoveryTimerRef.current);
                recoveryTimerRef.current = null;
            }
            if (revealTimerRef.current) {
                window.clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
            }
        };
    }, [gameCode, showAlert]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && gameCode && socket.connected && !isTransitioning) {
                socket.emit('get-state', gameCode);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [gameCode, isTransitioning]);

    useEffect(() => {
        if (gameCode && multiplayerConnected) socket.emit('get-state', gameCode);
    }, [gameCode, multiplayerConnected]);

    useEffect(() => {
        if (isRevealPhase) return;
        if (!currentQuestion?.endTime) {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }
        if (!timerRef.current) {
            const endTime = currentQuestion.endTime;
            timerRef.current = window.setInterval(() => {
                const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    if (timerRef.current) window.clearInterval(timerRef.current);
                    timerRef.current = null;
                    if (gameCode) {
                        socket.emit('get-state', gameCode);
                    }
                }
            }, 1000) as unknown as number;
        }
        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [currentQuestion?.endTime, gameCode, isRevealPhase]);

    const isHost = players.length > 0 && players[0].id === socket.id;

    /**
     * Emits a request to start the game when the host finalizes lobby settings.
     * Applies selected category, difficulty, and time limit options.
     */
    const handleStart = () => {
        if (!isHost || !gameCode || starting || !requireServer(true)) return;
        const count = /^\d+$/.test(amount) ? Number(amount) : 0;
        const seconds = /^\d+$/.test(timeLimit) ? Number(timeLimit) : 0;
        if (count < 1 || count > 50 || (isTimeLimitEnabled && (seconds < 5 || seconds > 120))) {
            showAlert('Choose 1–50 questions and a time limit of 5–120 seconds.');
            return;
        }
        setStarting(true);
        const settings = {
            category: category || undefined,
            difficulty: difficulty || undefined,
            amount: count,
            timeLimit: isTimeLimitEnabled ? seconds : null,
        };
        socket.emit('start-game', { gameCode, settings });
    };

    /**
     * Sends the player's selected answer to the server for the active question.
     * Prevents duplicate submissions and ignores expired questions.
     * @param answer - Option chosen by the current player.
     */
    const handleSubmitAnswer = (answer: string) => {
        if (!gameCode || currentQuestion?.index == null || (currentQuestion?.timeLimit && timeLeft <= 0)) return;
        if (selectedAnswer || !requireServer(true)) return;
        setSelectedAnswer(answer);
        socket.emit('submit-answer', { gameCode, answer, questionIndex: currentQuestion.index });
    };

    /**
     * Leaves the current multiplayer session and returns the user to the landing page.
     */
    const handleLeave = () => {
        if (gameCode && socket.connected) socket.emit('leave-game', { gameCode });
        sessionStorage.removeItem('joinedLobby');
        router.push('/');
    };

    const handleStayInLobby = () => {
        setShowGameOver(false);
    };

    return { router, gameCode, players, joined, guestName, setGuestName, joining, isAuthModalOpen, setIsAuthModalOpen, user, profile, multiplayerConnected, category, setCategory, difficulty, setDifficulty, amount, setAmount, isTimeLimitEnabled, setIsTimeLimitEnabled, timeLimit, setTimeLimit, inGame, currentQuestion, timeLeft, isRevealPhase, selectedAnswer, revealedAnswer, everyoneAnswered, showGameOver, winners, starting, maxPlayers, joinLobby, isHost, handleStart, handleSubmitAnswer, handleLeave, handleStayInLobby };
}
