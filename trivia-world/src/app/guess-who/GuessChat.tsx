'use client';
import { useState } from 'react';
import type { GuessAction, GuessState } from '@/lib/guess-who/types';
import { GuessButton, inputClass, panelClass } from './ui';
type Props = { state: GuessState; act: (action: GuessAction) => Promise<boolean>; canAct: boolean; canGuess: boolean; guessing: boolean };
export default function GuessChat({ state, act, canAct, canGuess, guessing }: Props) {
    if (!state.settings.chat) return <div className={panelClass}><h3 className="font-bold">Talk & play</h3><p className="mt-3 text-sm text-blue-100/70">Ask and answer aloud, in person or on your call. After your friend answers, press End Turn.</p><p className="mt-3 text-xs text-blue-100/60">Text chat is off for this game. Final guesses are still checked here.</p></div>;
    return <div className={panelClass}><h3 className="font-bold">Questions & answers</h3><p className="mt-2 mb-4 text-xs text-blue-100/60">One yes/no question per turn. An answer passes the turn.</p>
        <details className="mb-4"><summary className="cursor-pointer rounded-md bg-white/5 p-2 text-sm text-blue-200">Question history</summary>
            <div role="log" aria-label="Question history" className="max-h-64 overflow-y-auto overscroll-contain space-y-3 mt-3">{state.messages.map(message => <div key={message.id} className={`rounded-md p-2.5 text-sm break-words ${message.kind === 'notice' ? 'text-blue-100/60 bg-white/5' : 'bg-blue-500/10'}`}>
                {message.playerId && <p className="mb-1 text-xs font-semibold text-blue-200">{message.playerId === state.meId ? 'You' : state.players.find(player => player.id === message.playerId)?.name}</p>}<p>{message.text}</p>
            </div>)}</div>
        </details>
        {state.phase === 'playing' && <ChatAction state={state} act={act} canAnswer={canAct} canAsk={canGuess && !guessing} />}
    </div>;
}
function ChatAction({ state, act, canAnswer, canAsk }: { state: GuessState; act: Props['act']; canAnswer: boolean; canAsk: boolean }) {
    const [question, setQuestion] = useState('');
    const ask = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (await act({ type: 'ask', text: question.trim() })) setQuestion(''); };
    if (state.pendingQuestion?.playerId !== state.meId && state.pendingQuestion) return <div>
        <p className="mb-3 text-sm font-semibold break-words">{state.pendingQuestion.text}</p><div className="flex flex-wrap gap-2">{(['Yes', 'No', 'Not sure'] as const).map(answer => <GuessButton key={answer} disabled={!canAnswer} onClick={() => void act({ type: 'answer', answer })} className="flex-1 px-2 text-sm">{answer}</GuessButton>)}</div>
    </div>;
    return <>{state.pendingQuestion && <p className="mb-3 rounded-md bg-blue-500/10 p-3 text-sm break-words">You asked: {state.pendingQuestion.text}</p>}
        <form onSubmit={ask}><label htmlFor="guess-question" className="mb-2 block text-sm">Your question</label><textarea id="guess-question" rows={2} maxLength={240} value={question} onChange={event => setQuestion(event.target.value)} disabled={!canAsk} placeholder={state.turnId === state.meId ? 'Ask a yes/no question…' : 'Wait for your turn…'} className={`${inputClass} resize-y text-base`} /><GuessButton type="submit" disabled={!canAsk || !question.trim()} className="mt-2 w-full">Ask Question</GuessButton></form>
    </>;
}
