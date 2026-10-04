'use client';
import type { GuessAction, GuessState } from '@/lib/guess-who/types';
import { GuessButton, panelClass } from './ui';
type Props = { state: GuessState | null; act: (action: GuessAction) => Promise<boolean>; canAct: boolean };
export default function GuessPlayers({ state, act, canAct }: Props) {
    const me = state?.players.find(player => player.id === state.meId);
    return <div className={panelClass}>
        <h2 className="mb-3 font-bold">Players ({state?.players.length || 1}/2)</h2>
        <ul className="space-y-2">{state ? state.players.map(player => <li key={player.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-white/5 p-3 text-sm">
            <span className="min-w-0 break-words">{player.id === state.meId ? 'You' : player.name}{player.id === state.hostId ? ' · Host' : ''}</span>
            <span className="shrink-0 text-blue-200">{!player.connected ? 'Reconnecting' : player.ready ? 'Ready' : 'Not ready'}</span>
        </li>) : <li className="rounded-md bg-white/5 p-3 text-sm text-blue-200">You · Host</li>}</ul>
        <GuessButton className="mt-4 w-full" aria-pressed={Boolean(me?.ready)} disabled={!me || !canAct} onClick={() => void act({ type: 'ready', ready: !me?.ready })}>{me?.ready ? 'Mark Not Ready' : 'Ready Up'}</GuessButton>
        <p className="mt-3 min-h-6 text-xs text-blue-100/60">{state?.players.length === 2 ? 'Ready status helps the host decide when to start.' : 'Invite a friend to fill the second spot.'}</p>
    </div>;
}
