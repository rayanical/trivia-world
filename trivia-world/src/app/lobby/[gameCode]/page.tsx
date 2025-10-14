'use client';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import CustomSelect from '@/app/components/CustomSelect';
import { socket } from '@/lib/socket';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@supabase/supabase-js';

const AuthModal = dynamic(() => import('@/app/components/AuthModal'), { ssr: false });

type PlayerView = { id?: string; name: string; score?: number; answered?: boolean; avatar?: string | null };
const CATEGORY_DISPLAY_MAP: Record<string, string> = {
    general_knowledge: 'General Knowledge',
    film_and_tv: 'Film & TV',
    music: 'Music',
    science: 'Science',
    history: 'History',
    sport_and_leisure: 'Sport & Leisure',
    geography: 'Geography',
    arts_and_literature: 'Arts & Literature',
    society_and_culture: 'Society & Culture',
    food_and_drink: 'Food & Drink',
};

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

/**
 * Renders the multiplayer lobby and in-game experience for a trivia match.
 * Coordinates socket events, player state, and host controls for the session.
 * @returns The multiplayer lobby or active game interface.
 */
export default function LobbyPage() {
    const params = useParams();
    const router = useRouter();
    const gameCode = params.gameCode;
    const [players, setPlayers] = useState<PlayerView[]>([]);
    const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
    const [guestName, setGuestName] = useState('');

    // Read browser-only sessionStorage after hydration to determine host/guest state
    useEffect(() => {
        const isHost = typeof window !== 'undefined' && sessionStorage.getItem('isCreatingGame') === 'true';
        if (isHost) {
            setHasAttemptedJoin(true);
            sessionStorage.removeItem('isCreatingGame');
        }

        // Pre-fill guest name if it exists
        if (typeof window !== 'undefined') {
            setGuestName(sessionStorage.getItem('playerName') || '');
        }
    }, []);

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const { user, profile } = useAuth();
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [category, setCategory] = useState<string>('');
    const [difficulty, setDifficulty] = useState<string>('');
    const [amount, setAmount] = useState<number>(10);
    const [isTimeLimitEnabled, setIsTimeLimitEnabled] = useState<boolean>(true);
    const [timeLimit, setTimeLimit] = useState<number>(15);
    const [inGame, setInGame] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isRevealPhase, setIsRevealPhase] = useState(false);
    const timerRef = useRef<number | null>(null);
    const revealTimerRef = useRef<number | null>(null);
    const recoveryTimerRef = useRef<number | null>(null);

    const selectedAnswerRef = useRef<string | null>(null);
    const currentQuestionRef = useRef<Question | null>(null);
    const userRef = useRef<User | null>(null);

    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
    const [everyoneAnswered, setEveryoneAnswered] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [winner, setWinner] = useState<PlayerView | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const maxPlayers = 8;

    /**
     * Converts trivia API category tokens into user-friendly display names.
     * @param apiCategory - Category identifier received from the backend or API.
     * @returns Normalized category label for presentation in the UI.
     */
    const formatCategory = (apiCategory?: string) => {
        if (!apiCategory) return 'Mixed';
        const normalized = apiCategory.toLowerCase().replace(/ /g, '_');
        if (CATEGORY_DISPLAY_MAP[normalized]) return CATEGORY_DISPLAY_MAP[normalized];
        return apiCategory.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    };

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        selectedAnswerRef.current = selectedAnswer;
    }, [selectedAnswer]);

    useEffect(() => {
        currentQuestionRef.current = currentQuestion;
    }, [currentQuestion]);

    useEffect(() => {
        const currentPlayerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') : null;
        if (currentPlayerName && currentPlayerName.length > 15) {
            const truncatedName = currentPlayerName.substring(0, 15);
            sessionStorage.setItem('playerName', truncatedName);
        }
    }, []);

    // Handle automatic joining for logged-in users
    useEffect(() => {
        // This effect runs when the component mounts or when user/profile changes (e.g., after login).
        if (gameCode && user && profile && !hasAttemptedJoin) {
            const playerIsAlreadyInLobby = players.some((p) => p.name === profile.username);

            if (!playerIsAlreadyInLobby && players.length < maxPlayers) {
                const player = {
                    name: profile.username,
                    avatar: profile.avatar_url,
                };
                sessionStorage.setItem('playerName', player.name || '');
                socket.emit('join-game', { gameCode, player });
                setHasAttemptedJoin(true);
            }
        }
    }, [gameCode, user, profile, hasAttemptedJoin, players, maxPlayers]);

    useEffect(() => {
        const triviaApiCategories = [
            { id: 4, name: 'General Knowledge' },
            { id: 2, name: 'Film & TV' },
            { id: 7, name: 'Music' },
            { id: 8, name: 'Science' },
            { id: 6, name: 'History' },
            { id: 10, name: 'Sport & Leisure' },
            { id: 5, name: 'Geography' },
            { id: 1, name: 'Arts & Literature' },
            { id: 9, name: 'Society & Culture' },
            { id: 3, name: 'Food & Drink' },
        ];
        setCategories(triviaApiCategories);
    }, []);

    useEffect(() => {
        const onUpdate = (list: PlayerView[]) => setPlayers(list);
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
            setWinner(null);
            setInGame(true);
            setCurrentQuestion(q);
            setTimeLeft(q.endTime ? Math.max(0, Math.ceil((q.endTime - Date.now()) / 1000)) : 0);
        };
        const onState = (payload: { players?: PlayerView[]; question?: Question; timeLeft?: number; myAnswer?: string }) => {
            if (payload.players) setPlayers(payload.players);
            if (payload.question) {
                if (recoveryTimerRef.current) {
                    window.clearTimeout(recoveryTimerRef.current);
                    recoveryTimerRef.current = null;
                }
                setRevealedAnswer(null);
                setInGame(true);
                setCurrentQuestion(payload.question);
                setTimeLeft(payload.question.endTime ? Math.max(0, Math.ceil((payload.question.endTime - Date.now()) / 1000)) : 0);
                setSelectedAnswer((prev) => payload.myAnswer ?? prev);
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
                revealTimerRef.current = window.setInterval(() => {
                    setTimeLeft((prev) => {
                        const curr = transitionEnd ? Math.max(0, Math.ceil((transitionEnd - Date.now()) / 1000)) : prev - 1;
                        if (curr <= 0) {
                            if (revealTimerRef.current) window.clearInterval(revealTimerRef.current);
                            revealTimerRef.current = null;
                            setCurrentQuestion(null);
                            setTimeLeft(0);
                            setRevealedAnswer(null);
                            setEveryoneAnswered(false);
                            setIsTransitioning(false);
                            setIsRevealPhase(false);
                            return 0;
                        }
                        return curr;
                    });
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

            if (userRef.current && selectedAnswerRef.current && currentQuestionRef.current?.difficulty && payload.correctAnswer) {
                const u = userRef.current as { id: string };
                const isCorrect = selectedAnswerRef.current === payload.correctAnswer;
                const difficulty = currentQuestionRef.current.difficulty.toLowerCase();
                try {
                    /**
                     * Persists per-question multiplayer performance for the authenticated player.
                     * Tracks difficulty-specific correctness to power post-game analytics.
                     */
                    const { error } = await supabase.rpc('update_multiplayer_question_stats', { p_user_id: u.id, p_diff: difficulty, p_correct: isCorrect });
                    if (error) console.error('Error updating question stats:', error);
                } catch (err) {
                    console.error('Unexpected error updating question stats:', err);
                }
            }
        };
        const onAllAnswered = (payload: { players?: PlayerView[] }) => {
            setPlayers(payload.players || []);
            setEveryoneAnswered(true);
        };
        const onGameOver = async (payload: { players?: PlayerView[] }) => {
            if (payload.players) {
                setPlayers(payload.players);
                if (payload.players.length > 0) {
                    const sortedPlayers = [...payload.players].sort((a, b) => (b.score || 0) - (a.score || 0));
                    setWinner(sortedPlayers[0]);
                } else {
                    setWinner(null);
                }
            } else {
                setPlayers([]);
                setWinner(null);
            }
            setInGame(false);
            setCurrentQuestion(null);
            setShowGameOver(true);
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

            if (userRef.current && payload.players && payload.players.length > 0) {
                const u = userRef.current as { id: string };
                const currentPlayerName = sessionStorage.getItem('playerName') || '';
                const myPlayer = payload.players.find((p) => p.name === currentPlayerName);
                if (myPlayer) {
                    const myScore = myPlayer.score || 0;
                    const maxScore = Math.max(...payload.players.map((p) => p.score || 0));
                    const won = myScore >= maxScore;
                    try {
                        /**
                         * Records aggregated multiplayer game results for the authenticated player.
                         * Updates win/loss totals based on the match outcome.
                         */
                        const { error } = await supabase.rpc('update_multiplayer_game_stats', { p_user_id: u.id, p_won: won });
                        if (error) console.error('Error updating game stats:', error);
                    } catch (err) {
                        console.error('Unexpected error updating game stats:', err);
                    }
                } else {
                    console.warn('No matching player found for stats update:', currentPlayerName);
                }
            }
        };

        socket.on('update-players', onUpdate);
        socket.on('state', onState);
        socket.on('question', onQuestion);
        socket.on('all-answered', onAllAnswered);
        socket.on('question-ended', onQuestionEnded);
        socket.on('game-over', onGameOver);

        const onReconnect = () => {
            if (gameCode) {
                socket.emit('get-state', gameCode);
                socket.emit('get-players', gameCode);
            }
        };
        socket.on('reconnect', onReconnect);

        return () => {
            socket.off('update-players', onUpdate);
            socket.off('state', onState);
            socket.off('question', onQuestion);
            socket.off('all-answered', onAllAnswered);
            socket.off('question-ended', onQuestionEnded);
            socket.off('game-over', onGameOver);
            socket.off('reconnect', onReconnect);

            if (recoveryTimerRef.current) {
                window.clearTimeout(recoveryTimerRef.current);
                recoveryTimerRef.current = null;
            }
            if (revealTimerRef.current) {
                window.clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
            }
        };
    }, [gameCode]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && gameCode && !isTransitioning) {
                socket.emit('get-state', gameCode);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [gameCode, isTransitioning]);

    useEffect(() => {
        if (gameCode) {
            socket.emit('get-players', gameCode);
            socket.emit('get-state', gameCode);
        }
    }, [gameCode]);

    useEffect(() => {
        if (isRevealPhase) return;
        if (!currentQuestion?.endTime || timeLeft <= 0) {
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
    }, [currentQuestion?.endTime, timeLeft, gameCode, isRevealPhase]);

    const currentPlayerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') : null;
    const isHost = players.length > 0 && players[0].name === currentPlayerName;

    /**
     * Emits a request to start the game when the host finalizes lobby settings.
     * Applies selected category, difficulty, and time limit options.
     */
    const handleStart = () => {
        if (!isHost || !gameCode) return;
        const settings = {
            category: category || undefined,
            difficulty: difficulty || undefined,
            amount: amount || 10,
            timeLimit: isTimeLimitEnabled ? timeLimit : null,
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
        if (selectedAnswer) return;
        setSelectedAnswer(answer);
        socket.emit('submit-answer', { gameCode, answer, questionIndex: currentQuestion.index });
    };

    /**
     * Leaves the current multiplayer session and returns the user to the landing page.
     */
    const handleLeave = () => {
        if (gameCode) socket.emit('leave-game', { gameCode });
        router.push('/');
    };

    const handleStayInLobby = () => {
        setShowGameOver(false);
        setWinner(null);
    };

    const handleGuestJoin = () => {
        if (guestName.trim()) {
            sessionStorage.setItem('playerName', guestName.trim());
            const player = {
                name: guestName.trim(),
                avatar: null,
            };
            socket.emit('join-game', { gameCode, player });
            setHasAttemptedJoin(true);
        }
    };

    // This condition now correctly handles all cases
    const needsToJoin = !user && !hasAttemptedJoin;

    if (needsToJoin) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#101710] text-white p-4">
                <div className="w-full max-w-md space-y-6">
                    <h1 className="text-4xl font-bold text-center">Join Lobby</h1>
                    <p className="text-center text-white/80">
                        Enter your name to join game: <span className="font-bold text-green-400">{gameCode}</span>
                    </p>

                    <input
                        className="w-full h-14 px-6 rounded-md bg-white/5 border border-white/20 text-white placeholder-white/60 text-center text-lg focus:ring-2 focus:ring-green-800"
                        placeholder="Enter Your Name"
                        type="text"
                        maxLength={15}
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && guestName.trim()) {
                                handleGuestJoin();
                            }
                        }}
                    />

                    <button
                        onClick={handleGuestJoin}
                        disabled={!guestName.trim()}
                        className="w-full h-14 rounded-md bg-green-800 hover:bg-green-900 text-white text-xl font-bold disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                        Join Game
                    </button>

                    <button onClick={() => router.push('/')} className="w-full h-12 rounded-md bg-gray-700 hover:bg-gray-800 text-white font-bold cursor-pointer transition-colors">
                        Back to Home
                    </button>

                    <div className="flex items-center gap-4 my-6">
                        <hr className="flex-grow border-white/20" />
                        <span className="text-white/60 text-sm">OR</span>
                        <hr className="flex-grow border-white/20" />
                    </div>

                    <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="w-full h-12 rounded-md bg-blue-800 hover:bg-blue-900 text-white font-bold cursor-pointer transition-colors"
                    >
                        Login/Signup
                    </button>
                </div>
                <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
            </div>
        );
    }

    if (showGameOver) {
        const currentPlayer = players.find((p) => p.name === currentPlayerName);
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#1A201A] text-white p-4">
                <h1 className="text-4xl font-bold mb-4">Game Over!</h1>
                {winner && (
                    <div className="text-center">
                        <h2 className="text-2xl mb-4">Winner:</h2>
                        {winner.avatar ? (
                            <Image src={winner.avatar} alt={winner.name} width={128} height={128} className="rounded-full mx-auto mb-4" />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-green-800 flex items-center justify-center text-5xl font-bold mx-auto mb-4">
                                {(winner.name?.charAt(0) ?? '?').toUpperCase()}
                            </div>
                        )}
                        <p className="text-3xl font-bold text-green-400">{winner.name}</p>
                    </div>
                )}
                {currentPlayer && winner && currentPlayer.name !== winner.name && (
                    <div className="mt-8 text-center">
                        <h3 className="text-xl">Your Stats:</h3>
                        <p>Score: {currentPlayer.score}</p>
                    </div>
                )}
                <div className="flex gap-4 mt-8">
                    <button onClick={handleStayInLobby} className="px-8 py-3 rounded-full bg-blue-700 hover:bg-blue-800 text-lg font-bold cursor-pointer">
                        Stay in Lobby
                    </button>
                    <button onClick={handleLeave} className="px-8 py-3 rounded-full bg-gray-700 hover:bg-gray-800 text-lg font-bold cursor-pointer">
                        Leave Lobby
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#101710] p-4 text-white relative">
            <div className="absolute top-4 right-4 z-10">
                {user ? (
                    <button onClick={() => router.push('/profile')} className="bg-blue-800 hover:bg-blue-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                        Profile
                    </button>
                ) : (
                    <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 hover:bg-green-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                        Login/Signup
                    </button>
                )}
            </div>
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
            {!inGame ? (
                <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-center gap-8 p-4">
                    <div className="hidden lg:block w-64 flex-shrink-0" />

                    {/* Centered setup */}
                    <div className="w-full max-w-md space-y-6 flex-shrink-0">
                        <h1 className="text-4xl font-bold mb-2 text-center">Game Code: {gameCode}</h1>
                        <p className="text-lg mb-4 text-center">
                            Players ({players.length}/{maxPlayers})
                        </p>

                        {isHost ? (
                            <div className="space-y-6">
                                <div>
                                    <label className="block mb-2 font-bold">Category</label>
                                    <CustomSelect
                                        options={[
                                            { value: '', label: 'Any' },
                                            ...categories.map((c) => ({
                                                value: c.name.toLowerCase().replace(/ & /g, '_and_').replace(/ /g, '_'),
                                                label: c.name,
                                            })),
                                        ]}
                                        value={category}
                                        onChange={setCategory}
                                        placeholder="Select a category..."
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 font-bold">Difficulty</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'easy', label: 'Easy' },
                                            { key: 'medium', label: 'Medium' },
                                            { key: 'hard', label: 'Hard' },
                                            { key: '', label: 'Random' },
                                        ].map(({ key, label }) => {
                                            const isSelected = difficulty === key;
                                            const selectedClass = isSelected
                                                ? key === 'easy'
                                                    ? 'bg-green-800'
                                                    : key === 'medium'
                                                    ? 'bg-yellow-500'
                                                    : key === 'hard'
                                                    ? 'bg-red-700'
                                                    : 'bg-blue-700'
                                                : 'bg-white/10 hover:bg-white/20';
                                            return (
                                                <button key={key} onClick={() => setDifficulty(key)} className={`p-3 rounded-md transition-colors cursor-pointer ${selectedClass}`}>
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block mb-2 font-bold">Questions</label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full p-2 rounded-md bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-green-800 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 font-bold">Time Limit</label>
                                    <div className="flex items-center gap-4 mb-2">
                                        <span>Enable Time Limit</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={isTimeLimitEnabled} onChange={(e) => setIsTimeLimitEnabled(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>
                                    {isTimeLimitEnabled && (
                                        <input
                                            type="number"
                                            value={timeLimit}
                                            min={5}
                                            max={45}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                if (val >= 5 && val <= 45) setTimeLimit(val);
                                            }}
                                            className="w-full p-2 rounded-md bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-green-800 cursor-pointer"
                                        />
                                    )}
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={handleLeave} className="flex-1 h-14 rounded-md bg-gray-700 text-xl font-bold hover:bg-gray-800 cursor-pointer">
                                        Home
                                    </button>
                                    <button onClick={handleStart} className="flex-1 h-14 rounded-md bg-green-800 text-xl font-bold hover:bg-green-900 cursor-pointer">
                                        Start Game
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-4">
                                <p className="text-lg">Waiting for host to start the game...</p>
                                <button onClick={handleLeave} className="px-6 py-3 rounded-md bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer">
                                    Leave Game
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sleek players panel on the right with equal spacing */}
                    <div className="w-full max-w-md lg:w-64 flex-shrink-0 order-first lg:order-last">
                        <div className="bg-gradient-to-br from-[#104423] to-[#0a2f18] rounded-xl p-5 shadow-2xl border border-green-900/30">
                            <h3 className="text-lg font-bold mb-3 text-center text-green-400">Players</h3>
                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                <ul className="space-y-2">
                                    {players.map((p) => (
                                        <li
                                            key={p.id || p.name}
                                            className="bg-white/5 backdrop-blur-sm p-2.5 rounded-lg font-medium text-sm border border-white/10 flex items-center justify-center gap-3"
                                        >
                                            {p.avatar ? (
                                                <div className="relative w-6 h-6 rounded-full overflow-hidden">
                                                    <Image src={p.avatar} alt={p.name} fill style={{ objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-green-800 flex items-center justify-center text-xs font-bold">
                                                    {(p.name?.charAt(0) ?? '?').toUpperCase()}
                                                </div>
                                            )}
                                            <span className={p.name === currentPlayerName ? 'text-[#22c55e] font-bold' : ''}>{p.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-4xl relative">
                    {everyoneAnswered && (
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none">
                            <div className="rounded-md bg-yellow-600/20 p-2 text-center text-yellow-200 backdrop-blur-sm">All players have answered</div>
                        </div>
                    )}

                    <div className="mb-4 flex flex-wrap justify-between items-center gap-2 text-xl font-bold">
                        <button onClick={handleLeave} className="text-sm bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded-md cursor-pointer">
                            Leave Game
                        </button>
                        <span>Game Code: {gameCode}</span>
                        <div className="text-sm">Players: {players.length}</div>
                    </div>
                    <div className="rounded-xl p-4 sm:p-6 bg-[#253325] w-full">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex flex-col w-full">
                                <div className="flex flex-wrap gap-4 justify-between text-gray-400 text-xs sm:text-base mb-4">
                                    <span>Question {currentQuestion?.index != null ? currentQuestion.index + 1 : ''}</span>
                                    <span className="capitalize">Category: {formatCategory(currentQuestion?.category)}</span>
                                    <span className="capitalize">
                                        Difficulty:{' '}
                                        <span
                                            className={`font-bold ${
                                                currentQuestion?.difficulty === 'easy'
                                                    ? 'text-green-600'
                                                    : currentQuestion?.difficulty === 'medium'
                                                    ? 'text-yellow-400'
                                                    : 'text-red-400'
                                            }`}
                                        >
                                            {currentQuestion?.difficulty || '—'}
                                        </span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <h3 className="text-lg sm:text-xl font-bold max-w-3xl">{currentQuestion?.question}</h3>
                                    <div className="text-center ml-4">
                                        {(isRevealPhase || !!currentQuestion?.timeLimit) && (
                                            <>
                                                <div className="text-sm text-gray-300">{isRevealPhase ? 'Next in' : 'Time Left'} </div>
                                                <div className="text-2xl sm:text-3xl font-bold">{timeLeft}s </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* everyoneAnswered banner moved above the top bar to avoid resizing the question container */}
                            {(currentQuestion?.all_answers || []).map((ans: string) => {
                                const isSelected = selectedAnswer === ans;
                                const isRevealed = revealedAnswer !== null;
                                const isCorrect = revealedAnswer === ans;
                                const buttonClass = isRevealed
                                    ? isCorrect
                                        ? 'border-green-500 bg-green-900 text-white'
                                        : isSelected
                                        ? 'border-red-500 bg-red-900 text-white'
                                        : 'border-[#3C4F3C] bg-[#1A201A] text-white/70'
                                    : `${isSelected ? 'ring-2 ring-green-500 bg-green-700 text-white' : 'hover:bg-white/20 bg-white/10 text-white'} cursor-pointer`;

                                return (
                                    <button
                                        key={ans}
                                        onClick={() => handleSubmitAnswer(ans)}
                                        className={`p-3 sm:p-4 rounded-lg text-left transition-all ${buttonClass}`}
                                        disabled={isRevealPhase || (!!currentQuestion?.timeLimit && timeLeft <= 0)}
                                    >
                                        {ans}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Players and scores display below Q&A */}
                    <div className="mt-6 w-full">
                        <div className="bg-gradient-to-br from-[#104423] to-[#0a2f18] rounded-xl p-4 shadow-xl border border-green-900/30">
                            <h3 className="text-lg font-bold mb-3 text-center text-green-400">Player Scores</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[...players]
                                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                                    .map((p, index) => (
                                        <div key={p.id || p.name} className="bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 flex items-center gap-3">
                                            <span className="font-bold text-lg w-6 text-center">{index + 1}</span>
                                            {p.avatar ? (
                                                <div className="relative w-10 h-10 rounded-full overflow-hidden">
                                                    <Image src={p.avatar} alt={p.name} fill style={{ objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center text-base font-bold">
                                                    {(p.name?.charAt(0) ?? '?').toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <span className={`font-medium text-sm truncate block ${p.name === currentPlayerName ? 'text-[#22c55e] font-bold' : ''}`}>{p.name}</span>
                                                <span className="text-green-400 font-bold text-xs">{p.score || 0} pts</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
