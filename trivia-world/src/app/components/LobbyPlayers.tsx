'use client';
import Image from 'next/image';
import { socket } from '@/lib/socket';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
type Props = Pick<ReturnType<typeof useLobbyGame>, 'players' | 'setReady' | 'multiplayerConnected' | 'starting'>;
export default function LobbyPlayers({ players, setReady, multiplayerConnected, starting }: Props) {
    const me = players.find(p => p.id === socket.id);
    return <section className="rounded-xl p-5 bg-green-950/70 border border-green-900/30">
        <h2 className="text-lg font-bold mb-3 text-center text-green-400">Players</h2>
        <ul className="space-y-2 max-h-72 overflow-y-auto">
            {players.map(p => {
                const self = p.id === socket.id || p.id === 'local-player';
                return <li key={self ? 'self' : p.id || p.name} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg text-sm border border-white/10">
                    {p.avatar ? <Image src={p.avatar} alt="" width={24} height={24} className="rounded-full shrink-0" />
                        : <span className="w-6 h-6 rounded-full bg-green-800 flex items-center justify-center shrink-0 text-xs">{self ? 'Y' : p.name.charAt(0).toUpperCase()}</span>}
                    <span className={`min-w-0 flex-1 truncate ${self ? 'text-green-400 font-bold' : ''}`}>{self ? 'You' : p.name}</span>
                    <span className={`text-xs ${p.disconnected ? 'text-yellow-200' : p.ready ? 'text-green-400' : 'text-white/60'}`}>{p.disconnected ? 'Reconnecting' : p.ready ? 'Ready' : 'Not ready'}</span>
                </li>;
            })}
        </ul>
        <button onClick={() => setReady(!me?.ready)} aria-pressed={Boolean(me?.ready)} disabled={!me || !multiplayerConnected || starting} className="mt-4 w-full rounded-md bg-green-800 hover:bg-green-900 h-11 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{me?.ready ? 'Mark Not Ready' : 'Ready Up'}</button>
        <p className="mt-2 text-xs text-white/60">Ready status helps the host decide when to start.</p>
    </section>;
}
