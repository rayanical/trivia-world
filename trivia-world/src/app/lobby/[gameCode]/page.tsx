'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import CustomSelect from '@/app/components/CustomSelect';
import { socket } from '@/lib/socket';
import AuthModal from '@/app/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';

type PlayerView = { id?: string; name: string; score?: number; answered?: boolean };
type Question = {
    index?: number;
    question: string;
    difficulty?: string;
    correct_answer?: string;
    incorrect_answers?: string[];
    all_answers?: string[];
    timeLimit?: number;
    endTime?: number; // Absolute end time for sync
};

export default function LobbyPage() {
    const params = useParams();
    const router = useRouter();
    const gameCode = params.gameCode;
    const [players, setPlayers] = useState<PlayerView[]>([]);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [user, setUser] = useState<unknown>(null);
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [category, setCategory] = useState<string>('');
    const [difficulty, setDifficulty] = useState<string>('');
    const [amount, setAmount] = useState<number>(10);
    const [inGame, setInGame] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const timerRef = useRef<number | null>(null);
    // Failsafe recovery timer: if we miss a question or transition, this will ask the server for state
    const recoveryTimerRef = useRef<number | null>(null);

    const selectedAnswerRef = useRef<string | null>(null);
    const currentQuestionRef = useRef<Question | null>(null);
    const userRef = useRef(user);

    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
    const [everyoneAnswered, setEveryoneAnswered] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const maxPlayers = 8;

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        selectedAnswerRef.current = selectedAnswer;
    }, [selectedAnswer]);

    useEffect(() => {
        currentQuestionRef.current = currentQuestion;
    }, [currentQuestion]);

    // Auth state management
    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Enforce 15 character limit on player names
    useEffect(() => {
        const currentPlayerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') : null;
        if (currentPlayerName && currentPlayerName.length > 15) {
            const truncatedName = currentPlayerName.substring(0, 15);
            sessionStorage.setItem('playerName', truncatedName);
        }
    }, []);

    useEffect(() => {
        // Set categories for The Trivia API
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
            setSelectedAnswer(null);
            setRevealedAnswer(null);
            setIsTransitioning(false);
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
                setSelectedAnswer(payload.myAnswer ?? selectedAnswer); // Preserve local if server state is nullish
            }
        };
        const onQuestionEnded = async (payload: { players?: PlayerView[]; correctAnswer?: string }) => {
            setPlayers(payload.players || []);
            setRevealedAnswer(payload.correctAnswer ?? null);
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentQuestion(null);
                setTimeLeft(0);
                setRevealedAnswer(null);
                setEveryoneAnswered(false);
            }, 2800);

            if (recoveryTimerRef.current) {
                window.clearTimeout(recoveryTimerRef.current);
                recoveryTimerRef.current = null;
            }
            recoveryTimerRef.current = window.setTimeout(() => {
                if (gameCode) socket.emit('get-state', gameCode);
                recoveryTimerRef.current = null;
            }, 5000) as unknown as number;

            console.log('Full question end debug:', {
                userId: userRef.current ? (userRef.current as any).id : null,
                hasSelectedAnswer: !!selectedAnswerRef.current,
                selectedAnswer: selectedAnswerRef.current,
                difficulty: currentQuestionRef.current?.difficulty,
                correctAnswer: payload.correctAnswer,
                isCorrect: selectedAnswerRef.current && payload.correctAnswer ? selectedAnswerRef.current === payload.correctAnswer : null,
                currentQuestionFull: currentQuestionRef.current, // Full object to inspect
            });

            // Update multiplayer question stats if user answered and is authenticated
            if (userRef.current && selectedAnswerRef.current && currentQuestionRef.current?.difficulty && payload.correctAnswer) {
                console.log('Attempting stats update with user:', userRef.current); // Additional log for debugging auth

                const u = userRef.current as { id: string };
                const isCorrect = selectedAnswerRef.current === payload.correctAnswer;
                const difficulty = currentQuestionRef.current.difficulty.toLowerCase();
                try {
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
            setPlayers(payload.players || []);
            setInGame(false);
            setCurrentQuestion(null);
            setTimeLeft(0);
            setSelectedAnswer(null);
            setRevealedAnswer(null);

            // Update multiplayer game stats if authenticated
            if (userRef.current && payload.players && payload.players.length > 0) {
                // ← Use userRef.current
                console.log('Attempting game stats update with user:', userRef.current); // Add log
                const u = userRef.current as { id: string };
                const currentPlayerName = sessionStorage.getItem('playerName') || ''; // Fallback
                const myPlayer = payload.players.find((p) => p.name === currentPlayerName);
                if (myPlayer) {
                    const myScore = myPlayer.score || 0;
                    const maxScore = Math.max(...payload.players.map((p) => p.score || 0));
                    const won = myScore >= maxScore;
                    console.log('Game RPC params:', { userId: u.id, won, myScore, maxScore }); // Add log
                    try {
                        const { error } = await supabase.rpc('update_multiplayer_game_stats', { p_user_id: u.id, p_won: won });
                        console.log('Game RPC response:', { error }); // Add log
                        if (error) console.error('Error updating game stats:', error);
                    } catch (err) {
                        console.error('Unexpected error updating game stats:', err);
                    }
                } else {
                    console.warn('No matching player found for stats update:', currentPlayerName); // Add warn
                }
            } else {
                console.log('Skipping game stats: no user or players'); // Add log
            }
        };

        socket.on('update-players', onUpdate);
        socket.on('state', onState);
        socket.on('question', onQuestion);
        socket.on('all-answered', onAllAnswered);
        socket.on('question-ended', onQuestionEnded);
        socket.on('game-over', onGameOver);

        // New: Handle reconnection by resyncing state
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
        };
    }, [gameCode]);

    // New: Resync when tab becomes visible (but not during transition)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && gameCode && !isTransitioning) {
                socket.emit('get-state', gameCode);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [gameCode, isTransitioning]);

    // Request current players when mounted
    useEffect(() => {
        if (gameCode) {
            socket.emit('get-players', gameCode);
            socket.emit('get-state', gameCode);
        }
    }, [gameCode]);

    // Countdown timer: Recalculate based on endTime to handle throttling
    useEffect(() => {
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
                    // Optional: Trigger recovery if timer expires locally but no question-ended received
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
    }, [currentQuestion?.endTime, timeLeft, gameCode]);

    const currentPlayerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') : null;
    const isHost = players.length > 0 && players[0].name === currentPlayerName;

    const handleStart = () => {
        if (!isHost || !gameCode) return;
        const settings = {
            category: category || undefined,
            difficulty: difficulty || undefined,
            amount: amount || 10,
        };
        socket.emit('start-game', { gameCode, settings });
    };

    const handleSubmitAnswer = (answer: string) => {
        if (!gameCode || currentQuestion?.index == null || timeLeft <= 0) return;
        if (selectedAnswer) return; // prevent re-clicks
        setSelectedAnswer(answer);
        console.log('Answer set and emitted:', { answer, questionIndex: currentQuestion?.index, timeLeft });
        socket.emit('submit-answer', { gameCode, answer, questionIndex: currentQuestion.index });
    };

    const handleLeave = () => {
        if (gameCode) socket.emit('leave-game', { gameCode });
        window.location.href = '/';
    };
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
                <div className="w-full max-w-7xl flex items-center justify-between gap-8 pl-16 pr-8">
                    {/* Left spacer for symmetry */}
                    <div className="w-64 flex-shrink-0" />

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
                                <button onClick={handleStart} className="w-full h-14 rounded-md bg-green-800 text-xl font-bold hover:bg-green-900 cursor-pointer">
                                    Start Game
                                </button>
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
                    <div className="w-64 flex-shrink-0">
                        <div className="bg-gradient-to-br from-[#104423] to-[#0a2f18] rounded-xl p-5 shadow-2xl border border-green-900/30">
                            <h3 className="text-lg font-bold mb-3 text-center text-green-400">Players</h3>
                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                <ul className="space-y-2">
                                    {players.map((p) => (
                                        <li
                                            key={p.name}
                                            className="bg-white/5 backdrop-blur-sm p-2.5 rounded-lg text-center font-medium text-sm border border-white/10 hover:bg-white/10 transition-colors"
                                        >
                                            {p.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-4xl">
                    <div className="mb-4 flex justify-between items-center text-xl font-bold">
                        <button onClick={handleLeave} className="text-sm bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded-md cursor-pointer">
                            Leave Game
                        </button>
                        <span>Game Code: {gameCode}</span>
                        <div className="text-sm">Players: {players.length}</div>
                    </div>
                    <div className="rounded-xl border border-border-color p-6 bg-[#253325] w-full">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <div className="text-sm text-gray-300">Question</div>
                                <h3 className="text-xl font-bold">{currentQuestion?.question}</h3>
                            </div>
                            <div className="text-center">
                                <div className="text-sm text-gray-300">Time Left</div>
                                <div className="text-3xl font-bold">{timeLeft}s</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {everyoneAnswered && <div className="col-span-full mb-2 rounded-md bg-yellow-600/20 p-2 text-center text-yellow-200">All players have answered</div>}
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
                                        className={`p-4 rounded-lg text-left transition-all ${buttonClass}`}
                                        disabled={timeLeft <= 0}
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
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {players.map((p) => (
                                    <div key={p.name} className="bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10">
                                        <div className="text-center">
                                            <div className="font-semibold text-sm truncate">{p.name}</div>
                                            <div className="text-green-400 font-bold text-lg mt-1">{p.score || 0}</div>
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
