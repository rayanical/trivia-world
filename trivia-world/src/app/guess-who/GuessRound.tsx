'use client';
import { useState } from 'react';
import { guessCategories, type GuessAction, type GuessCard, type GuessState } from '@/lib/guess-who/types';
import { GuessButton, panelClass } from './ui';
import GuessBoard, { CardArtwork } from './GuessBoard';
import GuessChat from './GuessChat';
import GuessPlayers from './GuessPlayers';
type Props = { state: GuessState; act: (action: GuessAction) => Promise<boolean>; pending: boolean; connected: boolean };
function readCrossed(state: GuessState) {
    try {
        const saved: unknown = JSON.parse(sessionStorage.getItem(`guess-board:${state.code}:${state.round}:${state.meId}`) || '[]');
        return new Set<string>(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && state.board.some(card => card.id === id)) : []);
    } catch { return new Set<string>(); }
}
function roundStatus(state: GuessState, allConnected: boolean) {
    const opponent = state.players.find(player => player.id !== state.meId);
    if (state.phase === 'finished') return state.winnerId === state.meId ? 'You guessed it!' : `${opponent?.name || 'Your friend'} guessed it!`;
    if (!allConnected) return 'Reconnecting…';
    if (state.phase === 'choosing') return state.secretId ? 'Secret locked in' : 'Choose your secret';
    if (state.pendingQuestion) return state.pendingQuestion.playerId === state.meId ? 'Waiting for an answer' : 'Answer your friend';
    return state.turnId === state.meId ? 'Your turn' : `${opponent?.name || 'Your friend'}’s turn`;
}
export default function GuessRound({ state, act, pending, connected }: Props) {
    const [crossed, setCrossed] = useState(() => readCrossed(state));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [guessing, setGuessing] = useState(false);
    const allConnected = connected && state.players.length === 2 && state.players.every(player => player.connected);
    const canAct = allConnected && !pending;
    const canGuess = state.phase === 'playing' && state.turnId === state.meId && !state.pendingQuestion && canAct;
    const mark = (id: string) => {
        const next = new Set(crossed); if (next.has(id)) next.delete(id); else next.add(id);
        setCrossed(next); try { sessionStorage.setItem(`guess-board:${state.code}:${state.round}:${state.meId}`, JSON.stringify([...next])); } catch {}
    };
    const pick = async () => { if (selectedId && await act({ type: 'select', cardId: selectedId })) setSelectedId(null); };
    const guess = async () => { if (selectedId && await act({ type: 'guess', cardId: selectedId })) { setGuessing(false); setSelectedId(null); } };
    const cancel = () => { setGuessing(false); setSelectedId(null); };
    return <><RoundToolbar state={state} status={roundStatus(state, allConnected)} selected={state.board.find(card => card.id === selectedId)} canAct={canAct} canGuess={canGuess} guessing={guessing} pending={pending} onPick={pick} onGuess={guess} onCancel={cancel} onBeginGuess={() => { setGuessing(true); setSelectedId(null); }} onEndTurn={() => void act({ type: 'end-turn' })} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">{state.phase === 'finished' && <RoundResult state={state} canAct={canAct} act={act} />}<GuessBoard state={state} crossed={crossed} selectedId={selectedId} guessing={guessing} canAct={canAct} canGuess={canGuess} onSelect={setSelectedId} onMark={mark} /></div>
            <aside className={`space-y-4 min-w-0 ${state.phase === 'playing' ? 'order-first lg:order-last' : ''}`}>
                {state.phase !== 'finished' && state.secretId && <MySecret card={state.board.find(card => card.id === state.secretId)} />}
                <GuessChat state={state} act={act} canAct={canAct} canGuess={canGuess} guessing={guessing} />
                <p className="text-xs leading-relaxed text-blue-100/50">Wrong guesses cost this turn and the next. Crossing out cards is private and instant.</p>
            </aside>
        </div></>;
}
type ToolbarProps = { state: GuessState; status: string; selected?: GuessCard; canAct: boolean; canGuess: boolean; guessing: boolean; pending: boolean; onPick: () => Promise<void>; onGuess: () => Promise<void>; onCancel: () => void; onBeginGuess: () => void; onEndTurn: () => void };
function RoundToolbar({ state, status, selected, canAct, canGuess, guessing, pending, onPick, onGuess, onCancel, onBeginGuess, onEndTurn }: ToolbarProps) {
    const category = guessCategories.find(item => item.id === state.category)?.name;
    const description = state.phase === 'finished' ? 'Secrets are revealed below. Play again with a fresh board.' : state.phase === 'choosing' ? 'Pick a card, then lock it in. Your choice stays private.' : 'Tap cards to cross them out. Tap again to restore them.';
    return <div className={`${panelClass} mb-5`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-blue-200">Round {state.round} · {category}</p><h2 className="mt-2 min-h-16 sm:min-h-8 text-2xl font-bold" aria-live="polite">{status}</h2><p className="mt-2 text-sm text-white/70">{description}</p></div>{state.phase === 'playing' && <div className="flex flex-wrap gap-2"><GuessButton onClick={onBeginGuess} disabled={!canGuess || guessing}>Make a Guess</GuessButton><GuessButton secondary onClick={onEndTurn} disabled={!canGuess || guessing}>End Turn</GuessButton></div>}</div>
        {state.players.find(player => player.id === state.meId)?.skipNext && <p className="mt-3 text-sm text-amber-200">Wrong guess: you’ll skip your next turn. Your friend gets two turns.</p>}
        {state.phase === 'choosing' && !state.secretId && <div className="mt-4 flex flex-wrap items-center gap-3"><GuessButton onClick={() => void onPick()} disabled={!selected || !canAct}>Lock in {selected ? selected.name : 'your secret'}</GuessButton><span className="text-xs text-blue-100/60">Your opponent sees the same board.</span></div>}
        {guessing && state.phase === 'playing' && <GuessConfirmation selected={selected} canGuess={canGuess} pending={pending} onGuess={onGuess} onCancel={onCancel} />}
    </div>;
}
function GuessConfirmation({ selected, canGuess, pending, onGuess, onCancel }: Pick<ToolbarProps, 'selected' | 'canGuess' | 'pending' | 'onGuess' | 'onCancel'>) {
    return <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/5 p-3"><p className="text-sm">{selected ? `Guess ${selected.name}?` : 'Select the card you think your friend chose.'} A wrong guess uses this turn and skips your next one.</p><div className="mt-3 flex flex-wrap gap-2"><GuessButton onClick={() => void onGuess()} disabled={!selected || !canGuess}>Confirm Guess</GuessButton><GuessButton secondary onClick={onCancel} disabled={pending}>Cancel Guess</GuessButton></div></div>;
}
function MySecret({ card }: { card?: GuessCard }) {
    const [show, setShow] = useState(false);
    if (!card) return null;
    return <div className={panelClass}><div className="flex items-center justify-between gap-2"><h3 className="font-bold">Your secret</h3><GuessButton secondary className="text-xs" onClick={() => setShow(value => !value)} aria-expanded={show}>{show ? 'Hide' : 'Show'}</GuessButton></div>{show ? <div className="mt-3"><CardArtwork card={card} className="h-32" /><p className="mt-2 text-center font-bold">{card.name}</p></div> : <p className="mt-3 text-xs text-blue-100/60">Hidden on your screen. Reveal it when you need a reminder.</p>}</div>;
}
function RoundResult({ state, canAct, act }: { state: GuessState; canAct: boolean; act: Props['act'] }) {
    return <div className={`${panelClass} mb-5`}><h3 className="mb-4 font-semibold">The secret cards</h3><div className="flex flex-wrap gap-4">{state.revealedSecrets.map(reveal => {
        const card = state.board.find(item => item.id === reveal.cardId); if (!card) return null;
        return <div key={reveal.playerId} className="w-28 text-center"><CardArtwork card={card} className="h-24" /><p className="mt-2 break-words text-sm font-bold">{card.name}</p><p className="text-xs text-blue-100/60">{state.players.find(player => player.id === reveal.playerId)?.name}</p></div>;
    })}</div><div className="mt-5"><GuessPlayers state={state} act={act} canAct={canAct} /></div><div className="mt-5">{state.hostId === state.meId ? <GuessButton disabled={!canAct} onClick={() => void act({ type: 'rematch' })}>Rematch · Fresh Board</GuessButton> : <p className="text-sm text-blue-100/70">Waiting for the host to start a rematch.</p>}</div></div>;
}
