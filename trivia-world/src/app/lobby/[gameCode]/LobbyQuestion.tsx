'use client';
import Image from 'next/image';
import { formatCategory } from '@/lib/categories';
import { socket } from '@/lib/socket';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
type LobbyViewProps = Pick<ReturnType<typeof useLobbyGame>, 'gameCode' | 'players' | 'currentQuestion' | 'timeLeft' | 'isRevealPhase' | 'selectedAnswer' | 'revealedAnswer' | 'everyoneAnswered' | 'handleSubmitAnswer' | 'handleLeave'>;
export default function LobbyQuestion({ gameCode, players, currentQuestion, timeLeft, isRevealPhase, selectedAnswer, revealedAnswer, everyoneAnswered, handleSubmitAnswer, handleLeave }: LobbyViewProps) {
return (
                <div className="w-full max-w-4xl relative">
                    {everyoneAnswered && (
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none">
                            <div className="rounded-md bg-yellow-600/20 p-2 text-center text-yellow-200 backdrop-blur-sm">All players have answered</div>
                        </div>
                    )}

                    <div className="mb-4 flex flex-col lg:flex-row flex-wrap justify-between items-center gap-2 text-xl font-bold">
                        <button
                            onClick={handleLeave}
                            className="order-1 lg:order-none text-xs lg:text-sm bg-gray-700 hover:bg-gray-800 px-3 py-1.5 lg:px-4 lg:py-2 rounded-md cursor-pointer self-start lg:self-center"
                        >
                            Leave Game
                        </button>
                        <span className="order-2 lg:order-none text-center lg:text-left text-white/80">
                            Game Code: <span className="text-white font-bold">{gameCode}</span>
                        </span>
                        <div className="order-3 lg:order-none text-xs lg:text-sm text-white/60">Players: {players.length}</div>
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
                                        className={`p-3 sm:p-4 rounded-lg text-left transition-colors ${buttonClass}`}
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
                                                    <Image src={p.avatar} alt={p.name} fill sizes="40px" style={{ objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center text-base font-bold">
                                                    {(p.name?.charAt(0) ?? '?').toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <span className={`font-medium text-sm truncate block ${p.id === socket.id ? 'text-[#22c55e] font-bold' : ''}`}>{p.name}</span>
                                                <span className="text-green-400 font-bold text-xs">{p.score || 0} pts</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
);
}
