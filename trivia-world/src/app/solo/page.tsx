'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import Spinner from '../components/Spinner';
import { useSoloGame } from '@/hooks/useSoloGame';
import SoloQuestionCard from './SoloQuestionCard';
import SoloSetup from './SoloSetup';
import SoloSummary from './SoloSummary';
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

/**
 * Renders the solo trivia game experience, including setup, gameplay, and summary states.
 * @returns The solo trivia game interface with configuration controls and question flow.
 */
export default function SoloGamePage() {
    const { user } = useAuth();
    return <SoloGameContent key={user?.id || 'guest'} />;
}

function SoloGameContent() {
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

    if (isGameOver) return <>
        <SoloSummary score={score} signedIn={!!profile} onProfile={() => router.push('/profile')} onHome={() => router.push('/')} onLogin={() => setIsAuthModalOpen(true)} resetGame={resetGame} />
        {isAuthModalOpen && <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />}
    </>;


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
                        {currentQuestion && <SoloQuestionCard question={currentQuestion} questionNumber={questionNumber} selectedAnswer={selectedAnswer} isAnswered={isAnswered} isSubmitting={isSubmitting} submitAnswer={submitAnswer} nextQuestion={nextQuestion} />}
                    </div>
                )}
            </div>
            {isAuthModalOpen && <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />}
        </>
    );
}
