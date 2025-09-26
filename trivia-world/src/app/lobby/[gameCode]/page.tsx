'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import CustomSelect from '@/app/components/CustomSelect';
import { socket } from '@/lib/socket';

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
    const gameCode = params.gameCode;
    const [players, setPlayers] = useState<PlayerView[]>([]);
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

    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
    const [everyoneAnswered, setEveryoneAnswered] = useState(false);

    const maxPlayers = 8;

    useEffect(() => {
        // fetch categories for host setup
        fetch('https://opentdb.com/api_category.php')
            .then((r) => r.json())
            .then((d) => setCategories(d.trivia_categories || []))
            .catch(() => setCategories([]));
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
            setInGame(true);
            setCurrentQuestion(q);
            setTimeLeft(Math.max(0, Math.ceil((q.endTime - Date.now()) / 1000)));
        };
        const onState = (payload: { players?: PlayerView[]; question?: Question; timeLeft?: number }) => {
            if (payload.players) setPlayers(payload.players);
            if (payload.question) {
                if (recoveryTimerRef.current) {
                    window.clearTimeout(recoveryTimerRef.current);
                    recoveryTimerRef.current = null;
                }
                setSelectedAnswer(null);
                setRevealedAnswer(null);
                setInGame(true);
                setCurrentQuestion(payload.question);
                setTimeLeft(Math.max(0, Math.ceil((payload.question.endTime - Date.now()) / 1000)));
            }
        };
        const onQuestionEnded = (payload: { players?: PlayerView[]; correctAnswer?: string }) => {
            setPlayers(payload.players || []);
            setRevealedAnswer(payload.correctAnswer ?? null);
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
        };
        const onAllAnswered = (payload: { players?: PlayerView[] }) => {
            setPlayers(payload.players || []);
            setEveryoneAnswered(true);
        };
        const onGameOver = (payload: { players?: PlayerView[] }) => {
            setPlayers(payload.players || []);
            setInGame(false);
            setCurrentQuestion(null);
            setTimeLeft(0);
            setSelectedAnswer(null);
            setRevealedAnswer(null);
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

    // New: Resync when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && gameCode) {
                socket.emit('get-state', gameCode);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [gameCode]);

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
            timerRef.current = window.setInterval(() => {
                const remaining = Math.max(0, Math.ceil((currentQuestion.endTime - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    // Optional: Trigger recovery if timer expires locally but no question-ended received
                    if (gameCode && currentQuestion) {
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
            category: category ? Number(category) : undefined,
            difficulty: difficulty || undefined,
            amount: amount || 10,
        };
        socket.emit('start-game', { gameCode, settings });
    };

    const handleSubmitAnswer = (answer: string) => {
        if (!gameCode || currentQuestion?.index == null || timeLeft <= 0) return;
        if (selectedAnswer) return; // prevent re-clicks
        setSelectedAnswer(answer);
        socket.emit('submit-answer', { gameCode, answer, questionIndex: currentQuestion.index });
    };

    const handleLeave = () => {
        if (gameCode) socket.emit('leave-game', { gameCode });
        window.location.href = '/';
    };
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="flex items-center justify-between border-b border-solid border-border-color px-10 py-4 shadow-lg">
                <div />
                <div>
                    <button onClick={handleLeave} className="rounded-md bg-red-700 hover:bg-red-800 px-3 py-2 text-white">
                        Leave Game
                    </button>
                </div>
            </header>

            <main className="flex gap-6 p-8">
                <section className="flex-1">
                    <p className="text-lg text-text-secondary">Game Code:</p>
                    <h2 className="text-5xl font-bold text-primary tracking-widest my-4 bg-[#104423] border border-border-color rounded-lg py-4">{gameCode}</h2>

                    {!inGame ? (
                        <div className="bg-[#104423] rounded-lg border border-border-color p-6">
                            <h3 className="text-2xl font-bold text-text-primary mb-4">
                                Players ({players.length}/{maxPlayers})
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                {players.map((p) => (
                                    <div key={p.name} className="flex flex-col items-center gap-2 p-4 bg-secondary rounded-lg">
                                        <div className="size-16 rounded-full bg-green-900 border-2 border-primary"></div>
                                        <p className="font-bold text-text-primary">{p.name}</p>
                                    </div>
                                ))}
                            </div>

                            {isHost && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block mb-2">Category</label>
                                        <CustomSelect
                                            options={[{ value: '', label: 'Any' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
                                            value={category}
                                            onChange={setCategory}
                                            placeholder="Select category"
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-2">Difficulty</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['', 'easy', 'medium', 'hard'].map((d) => (
                                                <button
                                                    key={d}
                                                    onClick={() => setDifficulty(d)}
                                                    className={`p-3 rounded-md transition-colors cursor-pointer ${difficulty === d ? 'bg-green-800' : 'bg-white/10'}`}
                                                >
                                                    {d === '' ? 'Any' : d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block mb-2">Questions</label>
                                        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-24 p-2 rounded-md bg-white/10" />
                                    </div>

                                    <div className="mt-4">
                                        <button
                                            onClick={handleStart}
                                            className="w-full max-w-xs flex items-center justify-center gap-2 rounded-md bg-green-800 hover:bg-green-900 px-6 py-4 text-lg font-bold text-white shadow-lg"
                                        >
                                            <span className="material-symbols-outlined">play_circle</span>
                                            <span>Start Game</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-border-color p-6 bg-[#253325] w-full">
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
                    )}
                </section>

                <aside className="w-72">
                    <div className="bg-[#104423] rounded-lg border border-border-color p-4 mb-4">
                        <h4 className="font-bold mb-2">Players & Scores</h4>
                        <ul className="space-y-2">
                            {players.map((p) => (
                                <li key={p.name} className="flex justify-between">
                                    <span>{p.name}</span>
                                    <span className="font-bold">{p.score ?? 0}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-[#104423] rounded-lg border border-border-color p-4">
                        <h4 className="font-bold mb-2">Status</h4>
                        <p>{inGame ? 'In Game' : 'Waiting in Lobby'}</p>
                    </div>
                </aside>
            </main>
        </div>
    );
}
