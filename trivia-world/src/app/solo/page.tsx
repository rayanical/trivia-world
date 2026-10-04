'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import Spinner from '../components/Spinner';
import { useSoloGame } from '@/hooks/useSoloGame';
import { formatCategory } from '@/lib/categories';
import SoloSetup from './SoloSetup';
import Icon from '../components/Icon';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
const AuthModal = dynamic(() => import('@/app/components/AuthModal'), { ssr: false });
function subscribeToStorage(onChange: () => void) {
    window.addEventListener('storage', onChange);
    return () => window.removeEventListener('storage', onChange);
}
function getGuestName() {
    try { return sessionStorage.getItem('playerName') || 'Guest'; } catch { return 'Guest'; }
}

function answerClass(answer: string, selected: string | null, correct: string | undefined, answered: boolean) {
    if (!answered) return answer === selected ? 'border-blue-400 bg-blue-900' : 'border-[#3C4F3C] bg-[#1A201A] hover:bg-[#253325] hover:border-primary';
    if (answer === correct) return 'border-green-500 bg-green-900';
    if (answer === selected) return 'border-red-500 bg-red-900';
    return 'border-[#3C4F3C] bg-[#1A201A]';
}

/**
 * Renders the solo trivia game experience, including setup, gameplay, and summary states.
 * @returns The solo trivia game interface with configuration controls and question flow.
 */
export default function SoloGamePage() {
    const router = useRouter();
    const { profile, requireServer } = useAuth();

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const guestName = useSyncExternalStore(subscribeToStorage, getGuestName, () => 'Guest');
    const playerName = profile?.username?.trim() || guestName;
    const playerAvatar = profile?.avatar_url || null;

    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState('');
    const { currentQuestion, questionNumber, score, selectedAnswer, isAnswered, isLoading, isSubmitting, gameStarted, isGameOver, fetchQuestions, startGame, nextQuestion, submitAnswer, endGame, resetGame } = useSoloGame(selectedCategory, selectedDifficulty);
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const handleStartGame = () => { if (requireServer()) startGame(); };
    useEffect(() => {
        if (!isAnswered) return;
        const frame = requestAnimationFrame(() => gameContainerRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }));
        return () => cancelAnimationFrame(frame);
    }, [isAnswered]);

    if (!gameStarted) return <>
        <SoloSetup name={playerName} avatar={playerAvatar} signedIn={!!profile} onProfile={() => router.push('/profile')} onLogin={() => setIsAuthModalOpen(true)} onHome={() => router.push('/')} onStart={handleStartGame} category={selectedCategory} setCategory={setSelectedCategory} difficulty={selectedDifficulty} setDifficulty={setSelectedDifficulty} />
        {isAuthModalOpen && <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />}
    </>;

    if (isGameOver) {
        return (
            <>
                <div className="flex h-screen flex-col items-center justify-center bg-[#1A201A] text-white">
                    <div className="absolute top-4 right-4">
                        {profile ? (
                            <button onClick={() => router.push('/profile')} className="bg-blue-800 hover:bg-blue-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                                Profile
                            </button>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 hover:bg-green-900 p-2 rounded-md text-white cursor-pointer transition-colors">
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
                        <button onClick={resetGame} className="flex-1 rounded-full bg-green-800 hover:bg-green-900 px-8 py-3 text-lg font-bold cursor-pointer">
                            Play Again
                        </button>
                    </div>
                </div>
                {isAuthModalOpen && <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />}
            </>
        );
    }


    return (
        <>
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#101710] p-4 text-white">
                <div className="absolute top-4 right-4">
                    {profile ? (
                        <button onClick={() => router.push('/profile')} className="bg-blue-800 hover:bg-blue-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                            Profile
                        </button>
                    ) : (
                        <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 hover:bg-green-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                            Login/Signup
                        </button>
                    )}
                </div>
                {isLoading && !currentQuestion ? (
                    <Spinner />
                ) : (
                    <div ref={gameContainerRef} className="w-full max-w-4xl">
                        <div className="mb-4 flex items-center gap-3 text-lg font-semibold">
                            {playerAvatar ? (
                                <div className="relative w-12 h-12 rounded-full overflow-hidden">
                                    <Image src={playerAvatar} alt="Player Avatar" fill sizes="48px" style={{ objectFit: 'cover' }} />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-green-800 flex items-center justify-center text-xl font-bold">{playerName?.charAt(0).toUpperCase()}</div>
                            )}
                            <span>{playerName}</span>
                        </div>
                        <div className="mb-4 flex flex-wrap justify-between items-center gap-2 text-xl font-bold">
                            <button onClick={() => router.push('/')} className="text-sm bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded-md flex items-center gap-2 cursor-pointer">
                                <Icon name="home" /> Main Menu
                            </button>
                            <span>
                                Correct Answers: <span className="text-green-800">{score}</span>
                            </span>
                            <button onClick={endGame} disabled={isSubmitting} className="text-sm bg-red-700 hover:bg-red-800 px-4 py-2 rounded-md cursor-pointer">
                                End Game
                            </button>
                        </div>

                        {!currentQuestion && !isLoading && <button onClick={fetchQuestions} className="p-3 rounded-md bg-green-800 cursor-pointer">Retry loading questions</button>}
                        {currentQuestion && (
                            <div className="flex flex-col gap-6 rounded-xl bg-[#253325] p-4 sm:p-6 shadow-lg">
                                <div className="flex justify-between text-gray-400">
                                    <span>Question {questionNumber}</span>
                                    <span className="capitalize">Category: {formatCategory(currentQuestion.category)}</span>
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
                                <h2 className="text-center text-lg sm:text-xl md:text-2xl font-bold text-white">{currentQuestion.question}</h2>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {currentQuestion.all_answers.map((answer) => (
                                        <button
                                            key={answer}
                                            onClick={() => submitAnswer(answer)}
                                            className={`flex w-full items-center gap-4 rounded-lg border-2 p-3 sm:p-4 text-left transition-colors ${answerClass(answer, selectedAnswer, currentQuestion.correct_answer, isAnswered)} ${
                                                !isAnswered ? 'cursor-pointer' : 'cursor'
                                            }`}
                                            disabled={isAnswered || isSubmitting}
                                        >
                                            <span className="text-base font-medium text-white">{answer}</span>
                                        </button>
                                    ))}
                                </div>

                                {isSubmitting && <p role="status" className="text-center text-white/70">Checking your answer…</p>}
                                {isAnswered && (
                                    <div className="flex justify-center pt-2">
                                        <button
                                            onClick={nextQuestion}
                                            className="h-12 min-w-[160px] rounded-full bg-green-800 hover:bg-green-900 px-6 text-lg font-bold text-white hover:scale-105 cursor-pointer"
                                        >
                                            Next Question
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {isAuthModalOpen && <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />}
        </>
    );
}
