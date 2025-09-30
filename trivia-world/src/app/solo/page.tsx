// app/solo/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import he from 'he';
import Spinner from '../components/Spinner';
import CustomSelect from '../components/CustomSelect';
import { supabase } from '@/lib/supabaseClient'; // <-- Import Supabase
import AuthModal from '../components/AuthModal';
// --- Type Definitions ---
type Category = { id: number; name: string };
type Question = {
    question: string;
    difficulty: 'easy' | 'medium' | 'hard';
    correct_answer: string;
    incorrect_answers: string[]; // This was missing from your provided code but is needed
    all_answers: string[];
};

// --- Main Component ---
export default function SoloGamePage() {
    const router = useRouter();

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [user, setUser] = useState<unknown>(null);
    const [playerName, setPlayerName] = useState<string>('Guest');

    // Add useEffect for auth
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

    // Read playerName from sessionStorage (defaults to 'Guest')
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem('playerName');
            if (stored && stored.trim() !== '') setPlayerName(stored);
            else {
                sessionStorage.setItem('playerName', 'Guest');
                setPlayerName('Guest');
            }
        } catch {
            // sessionStorage might not be available; keep default
        }
    }, []);

    // **State for game setup**
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
    const [gameStarted, setGameStarted] = useState<boolean>(false);

    // **State for active game**
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null); // Add this state
    const [isAnswered, setIsAnswered] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isGameOver, setIsGameOver] = useState(false);

    // --- Data Fetching ---
    useEffect(() => {
        // Reordered the list to show the most popular categories first
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

    const fetchQuestions = useCallback(async () => {
        setIsLoading(true); // This line was missing in your file but should be here
        let apiUrl = `https://the-trivia-api.com/v2/questions?limit=10`;

        // Use selectedCategory directly, since it's now the correct format
        if (selectedCategory) {
            apiUrl += `&categories=${selectedCategory}`;
        }

        if (selectedDifficulty) {
            apiUrl += `&difficulties=${selectedDifficulty}`;
        }
        // --- CHANGE 2: UPDATE HOW YOU PROCESS THE RESPONSE ---
        const data = await fetch(apiUrl).then((res) => res.json());

        // The data structure from The Trivia API is slightly different.
        const formattedQuestions = data.map((q: any) => {
            // Use 'any' for simplicity here
            const allAnswers = [...q.incorrectAnswers, q.correctAnswer];
            // Shuffle the answers
            allAnswers.sort(() => Math.random() - 0.5);

            return {
                question: q.question.text, // Question is in a 'text' object
                difficulty: q.difficulty,
                correct_answer: q.correctAnswer, // Note the camelCase
                incorrect_answers: q.incorrectAnswers,
                all_answers: allAnswers,
            };
        });

        setQuestions((prev) => [...prev, ...formattedQuestions]);
        setIsLoading(false);
    }, [selectedCategory, selectedDifficulty]);

    // --- Game Flow Handlers ---
    const handleStartGame = () => {
        if (!selectedCategory || selectedDifficulty === null) {
            alert('Please select a category and difficulty.');
            return;
        }
        // Reset game state in case user restarts
        setScore(0);
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setIsGameOver(false);
        setGameStarted(true);
        fetchQuestions();
    };

    // **BUG FIX:** Reset selectedAnswer to null for the next round
    const handleNextQuestion = () => {
        if (currentQuestionIndex >= questions.length - 3) fetchQuestions();
        setIsAnswered(false);
        setSelectedAnswer(null); // Reset the selected answer
        setCurrentQuestionIndex((prev) => prev + 1);
    };

    const handleAnswerSelect = async (answer: string) => {
        if (isAnswered) return;
        setSelectedAnswer(answer); // Set the selected answer
        setIsAnswered(true);
        const isCorrect = answer === questions[currentQuestionIndex].correct_answer;
        if (isCorrect) {
            // Increment count of correct answers
            setScore((prevScore) => prevScore + 1);
        }
        if (user) {
            const u = user as Record<string, unknown>;
            if (typeof u.id === 'string') {
                const difficulty = questions[currentQuestionIndex].difficulty;
                await supabase.rpc('update_solo_stats', { p_user_id: String(u.id), p_diff: difficulty, p_correct: isCorrect });
            }
        }
    };
    const handleEndGame = () => setIsGameOver(true);

    // --- UI Rendering ---

    // **Screen 1: Game Setup**
    if (!gameStarted) {
        const categoryOptions = categories.map((cat) => ({
            // Format the name for the API URL (e.g., "Arts & Literature" -> "arts_and_literature")
            value: cat.name.toLowerCase().replace(/ & /g, '_and_').replace(/ /g, '_'),
            label: cat.name,
        }));
        return (
            <>
                <div className="flex h-screen flex-col items-center justify-center bg-[#101710] p-4 text-white">
                    <div className="absolute top-4 right-4">
                        {user ? (
                            <button onClick={() => router.push('/profile')} className="bg-blue-800 p-2 rounded-md">
                                Profile
                            </button>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 p-2 rounded-md">
                                Login/Signup
                            </button>
                        )}
                    </div>
                    <h1 className="text-4xl font-bold mb-2">Hi, {playerName}!</h1>
                    <p className="text-lg mb-6">Setup Your Solo Game</p>
                    <div className="w-full max-w-md space-y-6">
                        <div>
                            <label className="block mb-2 font-bold">Category</label>
                            <CustomSelect options={categoryOptions} value={selectedCategory} onChange={setSelectedCategory} placeholder="Select a category..." />
                        </div>
                        <div>
                            <label className="block mb-2 font-bold">Difficulty</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Easy', 'Medium', 'Hard', 'Random'].map((diff) => {
                                    const key = diff === 'Random' ? '' : diff.toLowerCase();
                                    const isSelected = selectedDifficulty === key;
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
                                        <button
                                            key={diff}
                                            onClick={() => setSelectedDifficulty(key)}
                                            // FIX: Added cursor-pointer for better UX
                                            className={`p-3 rounded-md transition-colors cursor-pointer ${selectedClass}`}
                                        >
                                            {diff}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => router.push('/')} className="flex-1 h-14 rounded-md bg-gray-700 text-xl font-bold hover:bg-gray-800 cursor-pointer">
                                Home
                            </button>
                            <button
                                onClick={handleStartGame}
                                // FIX: Added bg-primary and cursor-pointer
                                className="flex-1 h-14 rounded-md bg-green-800 text-xl font-bold hover:bg-green-900 cursor-pointer"
                            >
                                Start Game
                            </button>
                        </div>
                    </div>
                </div>
                <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
            </>
        );
    }

    // **Screen 2: Game Over**
    if (isGameOver) {
        return (
            <>
                <div className="flex h-screen flex-col items-center justify-center bg-[#1A201A] text-white">
                    <div className="absolute top-4 right-4">
                        {user ? (
                            <button onClick={() => router.push('/profile')} className="bg-blue-800 p-2 rounded-md">
                                Profile
                            </button>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 p-2 rounded-md">
                                Login/Signup
                            </button>
                        )}
                    </div>
                    <h1 className="text-4xl font-bold">Game Over!</h1>
                    <p className="text-2xl mt-4">Correct Answers:</p>
                    <p className="text-6xl font-bold text-green-800 my-8">{score}</p>
                    <div className="flex gap-4">
                        <button onClick={() => router.push('/')} className="flex-1 rounded-full bg-gray-700 hover:bg-gray-800 px-8 py-3 text-lg font-bold cursor-pointer">
                            Home
                        </button>
                        <button onClick={() => window.location.reload()} className="flex-1 rounded-full bg-green-800 hover:bg-green-900 px-8 py-3 text-lg font-bold cursor-pointer">
                            Play Again
                        </button>
                    </div>
                </div>
                <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
            </>
        );
    }

    // **Screen 3: Active Game**
    const currentQuestion = questions[currentQuestionIndex];

    const getButtonClass = (answer: string) => {
        if (!isAnswered) return 'border-[#3C4F3C] bg-[#1A201A] hover:border-primary';
        if (answer === currentQuestion.correct_answer) return 'border-green-500 bg-green-900';
        if (answer === selectedAnswer) return 'border-red-500 bg-red-900';
        return 'border-[#3C4F3C] bg-[#1A201A]';
    };

    return (
        <>
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#1A201A] p-4">
                <div className="absolute top-4 right-4">
                    {user ? (
                        <button onClick={() => router.push('/profile')} className="bg-blue-800 p-2 rounded-md">
                            Profile
                        </button>
                    ) : (
                        <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 p-2 rounded-md">
                            Login/Signup
                        </button>
                    )}
                </div>
                {isLoading && !currentQuestion ? (
                    <Spinner />
                ) : (
                    <div className="w-full max-w-4xl">
                        {/* **FIX:** Re-added the full top bar with Main Menu button */}
                        <div className="mb-2 text-lg font-semibold">{playerName}</div>
                        <div className="mb-4 flex justify-between items-center text-xl font-bold">
                            <button onClick={() => router.push('/')} className="text-sm bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded-md flex items-center gap-2 cursor-pointer">
                                <span className="material-symbols-outlined">home</span> Main Menu
                            </button>
                            <span>
                                Correct Answers: <span className="text-green-800">{score}</span>
                            </span>
                            <button onClick={handleEndGame} className="text-sm bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md cursor-pointer">
                                End Game
                            </button>
                        </div>

                        {currentQuestion && (
                            <div className="flex flex-col gap-6 rounded-xl bg-[#253325] p-6 shadow-lg">
                                <div className="flex justify-between text-gray-400">
                                    <span>Question {currentQuestionIndex + 1}</span>
                                    <span className="capitalize">
                                        Difficulty:{' '}
                                        <span
                                            className={`font-bold ${
                                                currentQuestion.difficulty === 'easy' ? 'text-green-600' : currentQuestion.difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'
                                            }`}
                                        >
                                            {currentQuestion.difficulty}
                                        </span>
                                    </span>
                                </div>
                                <h2 className="text-center text-3xl font-bold text-white">{currentQuestion.question}</h2>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {currentQuestion.all_answers.map((answer) => (
                                        <button
                                            key={answer}
                                            onClick={() => handleAnswerSelect(answer)}
                                            className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-all ${getButtonClass(answer)} ${
                                                !isAnswered ? 'cursor-pointer' : 'cursor'
                                            }`}
                                            disabled={isAnswered}
                                        >
                                            <span className="text-base font-medium text-white">{answer}</span>
                                        </button>
                                    ))}
                                </div>

                                {isAnswered && (
                                    <div className="flex justify-center pt-2">
                                        {isLoading ? (
                                            <Spinner />
                                        ) : (
                                            <button
                                                onClick={handleNextQuestion}
                                                className="h-12 min-w-[160px] rounded-full bg-green-800 hover:bg-green-900 px-6 text-lg font-bold text-white hover:scale-105 cursor-pointer"
                                            >
                                                Next Question
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </>
    );
}
