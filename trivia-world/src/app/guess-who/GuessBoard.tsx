'use client';
import Image from 'next/image';
import type { GuessCard, GuessState } from '@/lib/guess-who/types';
export function CardArtwork({ card, className = '' }: { card: GuessCard; className?: string }) {
    return <div className={`relative overflow-hidden rounded-md bg-blue-50 ${className}`}>
        <Image src={card.image} alt="" fill sizes="(max-width: 640px) 90px, 180px" className={card.category === 'celebrities' ? 'object-cover' : 'object-contain p-2'} />
    </div>;
}
type Props = { state: GuessState; crossed: Set<string>; selectedId: string | null; guessing: boolean; canAct: boolean; canGuess: boolean; onSelect: (id: string) => void; onMark: (id: string) => void };
export default function GuessBoard({ state, crossed, selectedId, guessing, canAct, canGuess, onSelect, onMark }: Props) {
    const choosing = state.phase === 'choosing';
    const picked = state.players.find(player => player.id === state.meId)?.picked;
    const disabled = choosing ? Boolean(picked) || !canAct : state.phase === 'finished' || (guessing && !canGuess);
    const selecting = choosing || guessing;
    return <><div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{choosing ? 'Shared board' : 'Your board'}</h3>
        <span className="text-xs text-blue-100/70">{state.board.length - crossed.size} cards remaining</span>
    </div><div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3">
        {state.board.map(card => <CardButton key={card.id} card={card} eliminated={!choosing && crossed.has(card.id)} selected={selecting && selectedId === card.id} selecting={selecting} choosing={choosing} disabled={disabled} onClick={() => selecting ? onSelect(card.id) : onMark(card.id)} />)}
    </div></>;
}
function CardButton({ card, eliminated, selected, selecting, choosing, disabled, onClick }: { card: GuessCard; eliminated: boolean; selected: boolean; selecting: boolean; choosing: boolean; disabled: boolean; onClick: () => void }) {
    const action = choosing ? 'Choose' : selecting ? 'Guess' : eliminated ? 'Restore' : 'Cross out';
    const appearance = selected ? 'border-blue-300 bg-blue-700/30' : 'border-blue-200/15 bg-[#16263f] hover:border-blue-300/60';
    return <button aria-label={`${action} ${card.name}`} aria-pressed={selecting ? selected : eliminated} disabled={disabled} onClick={onClick} className={`relative min-w-0 rounded-lg border-2 p-1.5 text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-200 disabled:cursor-default ${appearance}`}>
        <div className={eliminated ? 'opacity-25 grayscale' : ''}><CardArtwork card={card} className="h-16 sm:h-20 xl:h-24" /><span className="mt-2 flex min-h-8 items-center justify-center break-words text-xs font-semibold leading-tight">{card.name}</span></div>
        {eliminated && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-4xl text-blue-100">×</span>}
    </button>;
}
