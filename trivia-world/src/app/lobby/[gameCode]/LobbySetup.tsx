'use client';
import LobbyPlayers from '@/app/components/LobbyPlayers';
import LobbyInvite from '@/app/components/LobbyInvite';
import LobbySettings from '@/app/components/LobbySettings';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
type LobbyViewProps = Pick<ReturnType<typeof useLobbyGame>, 'gameCode' | 'players' | 'multiplayerConnected' | 'category' | 'setCategory' | 'difficulty' | 'setDifficulty' | 'amount' | 'setAmount' | 'isTimeLimitEnabled' | 'setIsTimeLimitEnabled' | 'timeLimit' | 'setTimeLimit' | 'starting' | 'maxPlayers' | 'isHost' | 'handleStart' | 'handleLeave' | 'setReady' | 'roomError'> & { connectionMessage?: string | null; retryConnection?: () => void; retryLabel?: string };
export default function LobbySetup({ gameCode, players, multiplayerConnected, category, setCategory, difficulty, setDifficulty, amount, setAmount, isTimeLimitEnabled, setIsTimeLimitEnabled, timeLimit, setTimeLimit, starting, maxPlayers, isHost, handleStart, handleLeave, connectionMessage, retryConnection, retryLabel = 'Retry Connection', setReady, roomError }: LobbyViewProps) {
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
                                        disabled={!gameCode || roomError !== null || starting || !multiplayerConnected}
                                        className="flex-1 h-12 sm:h-14 rounded-md bg-green-800 text-base sm:text-xl font-bold hover:bg-green-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Start Game
                                    </button>
                                </div>
                                <div className="h-20 text-sm text-white/60" aria-live="polite">
                                    {starting ? <p>Preparing the questions. Your settings are unchanged.</p> : connectionMessage && <p>{connectionMessage}</p>}
                                    {retryConnection && <button onClick={retryConnection} className="mt-2 text-green-400 underline cursor-pointer">{retryLabel}</button>}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-4">
                                <p className="text-lg">Waiting for host to start the game...</p>
                                <p className="min-h-6 text-sm text-white/60" role="status">{connectionMessage}</p>
                                <button onClick={handleLeave} className="px-6 py-3 rounded-md bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer">
                                    Leave Game
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sleek players panel on the right with equal spacing */}
                    <div className="w-full max-w-md lg:max-w-xs lg:w-72 flex-shrink-0 order-2 lg:order-last">
                        <div className="space-y-4">
                            <LobbyPlayers players={players} setReady={setReady} multiplayerConnected={multiplayerConnected} starting={starting} />
                            <LobbyInvite gameCode={gameCode} disabled={roomError !== null} />
                        </div>
                    </div>
                </div>
);
}
