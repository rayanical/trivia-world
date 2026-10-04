'use client';
import { useMemo, useState } from 'react';

export type UserStats = {
    solo_questions_answered: number;
    solo_questions_correct: number;
    solo_easy_correct: number;
    solo_medium_correct: number;
    solo_hard_correct: number;
    multiplayer_games_played: number;
    multiplayer_games_won: number;
    multiplayer_questions_answered: number;
    multiplayer_questions_correct: number;
    multiplayer_easy_correct: number;
    multiplayer_medium_correct: number;
    multiplayer_hard_correct: number;
};


export default function ProfileStats({ stats, loading, error, onRetry }: { stats: UserStats | null; loading: boolean; error: string | null; onRetry: () => void }) {
    const [activeTab, setActiveTab] = useState<'general' | 'solo' | 'multiplayer'>('general');
    const safeStats = useMemo<UserStats>(() => {
        return (
            stats || {
        solo_questions_answered: 0,
        solo_questions_correct: 0,
        solo_easy_correct: 0,
        solo_medium_correct: 0,
        solo_hard_correct: 0,
        multiplayer_games_played: 0,
        multiplayer_games_won: 0,
        multiplayer_questions_answered: 0,
        multiplayer_questions_correct: 0,
        multiplayer_easy_correct: 0,
        multiplayer_medium_correct: 0,
        multiplayer_hard_correct: 0,
            }
        );
    }, [stats]);

    /**
     * Calculates a percentage helper for statistic cards while guarding division by zero.
     * @param num - The numerator count, typically correct answers.
     * @param denom - The denominator count, typically total attempts.
     * @returns Formatted percentage or em dash when denominator is zero.
     */
    const percent = (num: number, denom: number) => (denom === 0 ? '—' : `${Math.round((num / denom) * 100)}%`);

    return (
        <section className="min-w-0 bg-white/5 rounded-lg p-4 sm:p-6">
            {loading && <p role="status" className="mb-4 text-white/70">Loading statistics…</p>}
            {error && <div role="status" className="mb-4 text-red-400">{error} <button onClick={onRetry} className="underline">Retry</button></div>}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold">Statistics</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-3 py-1 rounded-md cursor-pointer ${activeTab === 'general' ? 'bg-green-800' : 'bg-white/6'}`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('solo')}
                        className={`px-3 py-1 rounded-md cursor-pointer ${activeTab === 'solo' ? 'bg-yellow-500 text-black' : 'bg-white/6'}`}
                    >
                        Solo
                    </button>
                    <button
                        onClick={() => setActiveTab('multiplayer')}
                        className={`px-3 py-1 rounded-md cursor-pointer ${activeTab === 'multiplayer' ? 'bg-red-600' : 'bg-white/6'}`}
                    >
                        Multiplayer
                    </button>
                </div>
            </div>

            {activeTab === 'general' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Total Solo Answered</div>
                        <div className="text-xl sm:text-2xl font-bold">{safeStats.solo_questions_answered}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Total Multiplayer Answered</div>
                        <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_questions_answered}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Games Played</div>
                        <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_games_played}</div>
                    </div>
                </div>
            )}

            {activeTab === 'solo' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Questions Answered</div>
                        <div className="text-xl sm:text-2xl font-bold">{safeStats.solo_questions_answered}</div>
                        <div className="text-sm text-gray-400">
                            Correct: {safeStats.solo_questions_correct} ({percent(safeStats.solo_questions_correct, safeStats.solo_questions_answered)})
                        </div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Easy Correct</div>
                        <div className="text-xl sm:text-2xl font-bold text-green-400">{safeStats.solo_easy_correct}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Medium Correct</div>
                        <div className="text-xl sm:text-2xl font-bold text-yellow-400">{safeStats.solo_medium_correct}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Hard Correct</div>
                        <div className="text-xl sm:text-2xl font-bold text-red-400">{safeStats.solo_hard_correct}</div>
                    </div>
                </div>
            )}

            {activeTab === 'multiplayer' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Matches Played</div>
                        <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_games_played}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Matches Won</div>
                        <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_games_won}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Multiplayer Correct</div>
                        <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_questions_correct}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Easy Correct</div>
                        <div className="text-xl sm:text-2xl font-bold text-green-400">{safeStats.multiplayer_easy_correct}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Medium Correct</div>
                        <div className="text-xl sm:text-2xl font-bold text-yellow-400">{safeStats.multiplayer_medium_correct}</div>
                    </div>
                    <div className="p-4 rounded-md bg-white/6">
                        <div className="text-sm text-gray-300">Hard Correct</div>
                        <div className="text-xl sm:text-2xl font-bold text-red-400">{safeStats.multiplayer_hard_correct}</div>
                    </div>
                </div>
            )}

            <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Details</h3>
                <div className="p-4 rounded-md bg-white/6">
                    <div className="text-sm text-gray-300">Solo accuracy</div>
                    <div className="text-xl font-bold">{percent(safeStats.solo_questions_correct, safeStats.solo_questions_answered)}</div>

                    <div className="mt-4 text-sm text-gray-300">Multiplayer accuracy</div>
                    <div className="text-xl font-bold">{percent(safeStats.multiplayer_questions_correct, safeStats.multiplayer_questions_answered)}</div>
                </div>
            </div>
        </section>
    );
}
