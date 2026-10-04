'use client';
import Image from 'next/image';
import { socket } from '@/lib/socket';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
type LobbyViewProps = Pick<ReturnType<typeof useLobbyGame>, 'players' | 'winners' | 'handleLeave' | 'handleStayInLobby'>;
export default function LobbyResults({ players, winners, handleLeave, handleStayInLobby }: LobbyViewProps) {
        const currentPlayer = players.find((p) => p.id === socket.id);
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#1A201A] text-white p-4">
                <h1 className="text-4xl font-bold mb-4">Game Over!</h1>
                <div className="text-center">
                    <h2 className="text-2xl mb-4">{winners.length > 1 ? 'Tie! Winners:' : 'Winner:'}</h2>
                    <div className="flex flex-wrap justify-center gap-6">
                        {winners.map(winner => <div key={winner.id}>
                            {winner.avatar ? <Image src={winner.avatar} alt={winner.name} width={96} height={96} className="rounded-full mx-auto mb-4" />
                                : <div className="w-24 h-24 rounded-full bg-green-800 flex items-center justify-center text-4xl font-bold mx-auto mb-4">{winner.name.charAt(0).toUpperCase()}</div>}
                            <p className="text-2xl font-bold text-green-400">{winner.name}</p>
                            <p>{winner.score || 0} pts</p>
                        </div>)}
                    </div>
                </div>
                {currentPlayer && !winners.some(p => p.id === currentPlayer.id) && <div className="mt-8 text-center"><h3 className="text-xl">Your Stats:</h3><p>Score: {currentPlayer.score}</p></div>}
                <div className="flex gap-4 mt-8">
                    <button onClick={handleStayInLobby} className="px-8 py-3 rounded-full bg-blue-700 hover:bg-blue-800 text-lg font-bold cursor-pointer">
                        Stay in Lobby
                    </button>
                    <button onClick={handleLeave} className="px-8 py-3 rounded-full bg-gray-700 hover:bg-gray-800 text-lg font-bold cursor-pointer">
                        Leave Lobby
                    </button>
                </div>
            </div>
        );
}
