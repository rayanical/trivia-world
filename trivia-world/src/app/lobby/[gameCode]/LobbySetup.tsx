'use client';
import Image from 'next/image';
import CustomSelect from '@/app/components/CustomSelect';
import { categoryOptions } from '@/lib/categories';
import { socket } from '@/lib/socket';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
type LobbyViewProps = Pick<ReturnType<typeof useLobbyGame>, 'gameCode' | 'players' | 'multiplayerConnected' | 'category' | 'setCategory' | 'difficulty' | 'setDifficulty' | 'amount' | 'setAmount' | 'isTimeLimitEnabled' | 'setIsTimeLimitEnabled' | 'timeLimit' | 'setTimeLimit' | 'starting' | 'maxPlayers' | 'isHost' | 'handleStart' | 'handleLeave'>;
export default function LobbySetup({ gameCode, players, multiplayerConnected, category, setCategory, difficulty, setDifficulty, amount, setAmount, isTimeLimitEnabled, setIsTimeLimitEnabled, timeLimit, setTimeLimit, starting, maxPlayers, isHost, handleStart, handleLeave }: LobbyViewProps) {
return (
                <div className="w-full max-w-7xl flex flex-col lg:flex-row items-stretch lg:items-center justify-start lg:justify-center gap-6 lg:gap-8 pt-4 lg:pt-0 lg:p-8">
                    <div className="hidden lg:block w-64 flex-shrink-0" />

                    {/* Centered setup */}
                    <div className="w-full max-w-md space-y-4 sm:space-y-6 flex-shrink-0 order-1 lg:order-none">
                        <h1 className="text-4xl font-bold mb-2 text-center">Game Code: {gameCode}</h1>
                        <p className="text-lg mb-4 text-center">
                            Players ({players.length}/{maxPlayers})
                        </p>

                        {isHost ? (
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="lobby-category" className="block mb-2 font-bold">Category</label>
                                    <CustomSelect
                                        id="lobby-category"
                                        options={categoryOptions}
                                        value={category}
                                        onChange={setCategory}
                                        placeholder="Select a category..."
                                    />
                                </div>
                                <div>
                                    <p className="block mb-2 font-bold">Difficulty</p>
                                    <div className="grid grid-cols-2 gap-3">
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
                                    <label htmlFor="question-count" className="block mb-2 font-bold">Questions</label>
                                    <input
                                        id="question-count" min={1} max={50} step={1}
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full p-2 rounded-md bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-green-800 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="time-limit" className="block mb-2 font-bold">Time Limit (seconds)</label>
                                    <div className="flex items-center gap-4 mb-2">
                                        <label htmlFor="enable-timer">Enable Time Limit</label>
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input id="enable-timer" aria-label="Enable Time Limit" type="checkbox" checked={isTimeLimitEnabled} onChange={(e) => setIsTimeLimitEnabled(e.target.checked)} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-transform dark:border-gray-600 peer-checked:bg-green-600"></div>
                                        </div>
                                    </div>
                                    {isTimeLimitEnabled && (
                                        <input
                                            id="time-limit"
                                            type="number"
                                            value={timeLimit}
                                            min={5}
                                            max={120}
                                            onChange={(e) => setTimeLimit(e.target.value)}
                                            className="w-full p-2 rounded-md bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-green-800 cursor-pointer"
                                        />
                                    )}
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleLeave}
                                        className="flex-1 h-12 sm:h-14 rounded-md bg-gray-700 text-base sm:text-xl font-bold hover:bg-gray-800 cursor-pointer"
                                    >
                                        Home
                                    </button>
                                    <button
                                        onClick={handleStart}
                                        disabled={starting || !multiplayerConnected}
                                        className="flex-1 h-12 sm:h-14 rounded-md bg-green-800 text-base sm:text-xl font-bold hover:bg-green-900 cursor-pointer"
                                    >
                                        {starting ? 'Loading questions…' : 'Start Game'}
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
                    <div className="w-full max-w-md lg:max-w-xs lg:w-72 flex-shrink-0 order-2 lg:order-last">
                        <div className="bg-gradient-to-br from-[#104423] to-[#0a2f18] rounded-xl p-5 shadow-2xl border border-green-900/30">
                            <h3 className="text-lg font-bold mb-3 text-center text-green-400">Players</h3>
                            <div className="max-h-60 lg:max-h-96 overflow-y-auto custom-scrollbar">
                                <ul className="space-y-2">
                                    {players.map((p) => (
                                        <li
                                            key={p.id || p.name}
                                            className="bg-white/5 backdrop-blur-sm p-2.5 rounded-lg font-medium text-sm border border-white/10 flex items-center justify-center gap-3"
                                        >
                                            {p.avatar ? (
                                                <div className="relative w-6 h-6 rounded-full overflow-hidden">
                                                    <Image src={p.avatar} alt={p.name} fill sizes="40px" style={{ objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-green-800 flex items-center justify-center text-xs font-bold">
                                                    {(p.name?.charAt(0) ?? '?').toUpperCase()}
                                                </div>
                                            )}
                                            <span className={p.id === socket.id ? 'text-[#22c55e] font-bold' : ''}>{p.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
);
}
