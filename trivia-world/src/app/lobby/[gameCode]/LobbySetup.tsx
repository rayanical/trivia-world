'use client';
import Image from 'next/image';
import LobbySettings from '@/app/components/LobbySettings';
import { socket } from '@/lib/socket';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
type LobbyViewProps = Pick<ReturnType<typeof useLobbyGame>, 'gameCode' | 'players' | 'multiplayerConnected' | 'category' | 'setCategory' | 'difficulty' | 'setDifficulty' | 'amount' | 'setAmount' | 'isTimeLimitEnabled' | 'setIsTimeLimitEnabled' | 'timeLimit' | 'setTimeLimit' | 'starting' | 'maxPlayers' | 'isHost' | 'handleStart' | 'handleLeave'> & { connectionMessage?: string | null; retryConnection?: () => void };
export default function LobbySetup({ gameCode, players, multiplayerConnected, category, setCategory, difficulty, setDifficulty, amount, setAmount, isTimeLimitEnabled, setIsTimeLimitEnabled, timeLimit, setTimeLimit, starting, maxPlayers, isHost, handleStart, handleLeave, connectionMessage, retryConnection }: LobbyViewProps) {
return (
                <div className="w-full max-w-7xl flex flex-col lg:flex-row items-stretch lg:items-center justify-start lg:justify-center gap-6 lg:gap-8 pt-4 lg:pt-0 lg:p-8">
                    <div className="hidden lg:block w-64 flex-shrink-0" />

                    {/* Centered setup */}
                    <div className="w-full max-w-md space-y-4 sm:space-y-6 flex-shrink-0 order-1 lg:order-none">
                        <h1 className="text-4xl font-bold mb-2 text-center">Multiplayer Lobby</h1>
                        <p className="text-center text-lg">Game Code: <span className="inline-block w-[5ch] font-mono font-bold" aria-busy={!gameCode}>{gameCode || '·····'}</span></p>
                        <p className="text-lg mb-4 text-center">
                            Players ({players.length}/{maxPlayers})
                        </p>

                        {isHost ? (
                            <div className="space-y-6">
                                <LobbySettings category={category} setCategory={setCategory} difficulty={difficulty} setDifficulty={setDifficulty} amount={amount} setAmount={setAmount} isTimeLimitEnabled={isTimeLimitEnabled} setIsTimeLimitEnabled={setIsTimeLimitEnabled} timeLimit={timeLimit} setTimeLimit={setTimeLimit} />
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleLeave}
                                        className="flex-1 h-12 sm:h-14 rounded-md bg-gray-700 text-base sm:text-xl font-bold hover:bg-gray-800 cursor-pointer"
                                    >
                                        Home
                                    </button>
                                    <button
                                        onClick={handleStart}
                                        disabled={!gameCode || starting || !multiplayerConnected}
                                        className="flex-1 h-12 sm:h-14 rounded-md bg-green-800 text-base sm:text-xl font-bold hover:bg-green-900 cursor-pointer"
                                    >
                                        Start Game
                                    </button>
                                </div>
                                <div className="h-20 text-sm text-white/60" aria-live="polite">
                                    {starting ? <p>Preparing the questions. Your settings are unchanged.</p> : connectionMessage && <p>{connectionMessage}</p>}
                                    {retryConnection && <button onClick={retryConnection} className="mt-2 text-green-400 underline cursor-pointer">Retry Connection</button>}
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
                                            key={p.id === socket.id || p.id === 'local-player' ? 'self' : p.id || p.name}
                                            className="bg-white/5 backdrop-blur-sm p-2.5 rounded-lg font-medium text-sm border border-white/10 flex items-center justify-center gap-3"
                                        >
                                            {p.avatar ? (
                                                <div className="relative w-6 h-6 rounded-full overflow-hidden">
                                                    <Image src={p.avatar} alt={p.name} fill sizes="40px" style={{ objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-green-800 flex items-center justify-center text-xs font-bold">
                                                    {p.id === socket.id || p.id === 'local-player' ? 'Y' : (p.name?.charAt(0) ?? '?').toUpperCase()}
                                                </div>
                                            )}
                                            <span className={p.id === socket.id || p.id === 'local-player' ? 'text-[#22c55e] font-bold' : ''}>{p.id === socket.id || p.id === 'local-player' ? 'You' : p.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
);
}
