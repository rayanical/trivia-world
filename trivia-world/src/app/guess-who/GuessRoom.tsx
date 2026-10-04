'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { guessCategories, type GuessAction, type GuessSettings, type GuessState } from '@/lib/guess-who/types';
import { useGuessRoom } from './useGuessRoom';
import { GuessButton, inputClass, panelClass } from './ui';
import GuessRound from './GuessRound';
import GuessInvite from './GuessInvite';
import GuessPlayers from './GuessPlayers';
export default function GuessRoom({ create = false, code }: { create?: boolean; code?: string }) {
    const { user } = useAuth(); return <GuessRoomContent key={user?.id || 'guest'} create={create} code={code} />;
}
function GuessRoomContent({ create, code }: { create: boolean; code?: string }) {
    const game = useGuessRoom(create, code); const router = useRouter();
    const leave = async () => { if (await game.act({ type: 'leave' })) router.push('/guess-who'); };
    const feedback = game.error || game.connectionError || (!game.connected && game.joined ? 'Connecting in the background. Your board and settings stay here.' : '');
    if (game.checkingMembership) return <section className="mx-auto max-w-md px-4 py-10"><div className={panelClass}><h1 className="text-3xl font-bold">Join Guess Who</h1><p className="mt-3 text-blue-100/70">Room <span className="font-mono font-bold">{code}</span> · Two players</p></div></section>;
    if (!game.joined) return <JoinPanel game={game} code={code} feedback={feedback} />;
    return <section className="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">{!game.state || game.state.phase === 'lobby' ? 'Game Lobby' : 'Guess Who'}</h1><p className="mt-1 text-sm text-blue-100/70">Game code: <span className="inline-block w-[5ch] font-mono font-bold">{game.state?.code || '·····'}</span></p></div><GuessButton secondary disabled={!game.state || game.pending || !game.connected} onClick={() => void leave()}>Leave Game</GuessButton></div>
        <div role="status" aria-live="polite" className="mb-4 min-h-10 text-sm text-amber-200">{feedback}{game.error && <Link href="/guess-who" className="ml-2 underline text-blue-200">Back to Guess Who</Link>}</div>
        <RoomBody game={game} leave={leave} returning={Boolean(code)} />
    </section>;
}

function JoinPanel({ game, code, feedback }: { game: ReturnType<typeof useGuessRoom>; code?: string; feedback: string }) {
    const [name, setName] = useState('');
    const join = async () => {
        const playerName = name.trim() || game.name();
        if (await game.act({ type: 'join', name: playerName })) {
            try { sessionStorage.setItem('playerName', playerName); } catch {}
        }
    };
    return <section className="mx-auto max-w-md px-4 py-10">
        <div className={panelClass}><h1 className="text-3xl font-bold">Join Guess Who</h1><p className="mt-3 mb-6 text-blue-100/70">Room <span className="font-mono font-bold">{code}</span> · Two players</p>
            <form onSubmit={event => { event.preventDefault(); void join(); }}>
                <label htmlFor="join-guess-name" className="mb-2 block text-sm">Your name (optional)</label><input id="join-guess-name" maxLength={15} autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} className={inputClass} placeholder="Enter your name" />
                <GuessButton type="submit" disabled={game.pending} className="mt-5 w-full">{game.pending ? 'Joining…' : 'Join Game'}</GuessButton>
            </form><p role="status" className="min-h-12 mt-4 text-sm text-amber-200">{feedback}</p><Link href="/guess-who" className="text-blue-200 underline">Back to Guess Who</Link>
        </div></section>;
}
function RoomBody({ game, leave, returning }: { game: ReturnType<typeof useGuessRoom>; leave: () => Promise<void>; returning: boolean }) {
    if (!game.state && returning) return <div className={panelClass}><h2 className="text-xl font-bold">Returning to your game</h2><p className="mt-3 text-blue-100/70">Your board will return when the connection is ready.</p></div>;
    if (!game.state || game.state.phase === 'lobby') return <GuessLobby state={game.state} act={game.act} pending={game.pending} connected={game.connected} />;
    if (game.state.phase === 'abandoned') return <div className={`${panelClass} text-center`}><h2 className="text-2xl font-bold">Your opponent left the game</h2><p className="my-4 text-white/70">This round has ended. Leave this room to start a fresh game.</p><GuessButton onClick={() => void leave()} disabled={game.pending || !game.connected}>Back to Guess Who</GuessButton></div>;
    return <GuessRound key={`${game.state.code}:${game.state.round}`} state={game.state} act={game.act} pending={game.pending} connected={game.connected} />;
}

function GuessLobby({ state, act, pending, connected }: { state: GuessState | null; act: (action: GuessAction) => Promise<boolean>; pending: boolean; connected: boolean }) {
    const [settings, setSettings] = useState<GuessSettings>({ category: 'random', chat: true });
    const host = !state || state.hostId === state.meId;
    const start = async () => { if (await act({ type: 'settings', ...settings })) await act({ type: 'start' }); };
    return <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className={panelClass}>
            <h2 className="mb-5 text-xl font-bold">Set up your game</h2>
            {host ? <><label htmlFor="guess-category" className="mb-2 block font-semibold">Category</label><select id="guess-category" value={settings.category} onChange={event => { const category = guessCategories.find(c => c.id === event.target.value)?.id; if (category) setSettings(value => ({ ...value, category })); }} disabled={pending} className={`${inputClass} bg-[#16263f]`}>{guessCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                <label className="mt-6 flex items-center justify-between gap-4 rounded-lg bg-white/5 p-4 cursor-pointer"><span><span className="block font-semibold">Text chat</span><span className="block mt-1 text-sm text-blue-100/70">Turn off if you’re talking in person or on a call.</span></span><input type="checkbox" checked={settings.chat} onChange={event => setSettings(value => ({ ...value, chat: event.target.checked }))} disabled={pending} className="h-5 w-5 shrink-0 accent-blue-500" /></label>
                <GuessButton onClick={() => void start()} disabled={!state || state.players.length !== 2 || state.players.some(p => !p.connected) || pending || !connected} className="mt-6 w-full min-h-12">{pending ? 'Starting…' : 'Start Game'}</GuessButton>
            </> : <p className="text-blue-100/70">The host is choosing the category and chat setting. The game starts when both players are here.</p>}
            <div className="mt-6 space-y-2 text-sm text-blue-100/70"><p>20 cards · 2 players · No timer</p><p>Pick a secret, then take turns asking yes/no questions.</p><p>A wrong guess uses this turn and skips your next one.</p><p>Both players can choose the same secret card.</p></div>
        </div>
        <div className="space-y-4"><GuessPlayers state={state} act={act} canAct={connected && !pending} /><GuessInvite code={state?.code || ''} /></div>
    </div>;
}
