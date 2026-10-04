'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuessButton, inputClass } from './ui';
export default function GuessHome() {
    const router = useRouter(); const [name, setName] = useState(''); const [code, setCode] = useState(''); const [error, setError] = useState('');
    const rememberName = () => { if (name.trim()) { try { sessionStorage.setItem('playerName', name.trim()); } catch {} } };
    const join = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); if (!/^[A-Z0-9]{5}$/.test(code)) { setError('Enter a five-character game code.'); return; }
        rememberName(); router.push(`/guess-who/room/${code}`);
    };
    return <section className="mx-auto flex min-h-[75svh] max-w-2xl flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md text-center">
            <p className="mb-3 text-sm uppercase tracking-widest text-blue-300">Two players · One mystery each</p>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tighter">Guess Who</h1>
            <p className="my-7 text-white/75">Pick a secret. Ask clever questions.<br />Find your friend’s card before they find yours.</p>
            <label htmlFor="guess-name" className="mb-2 block text-sm text-blue-100/70">Your name (optional)</label>
            <input id="guess-name" autoComplete="nickname" value={name} maxLength={15} onChange={event => setName(event.target.value)} className={`${inputClass} mb-5 text-center`} placeholder="Enter your name" />
            <GuessButton onClick={() => { rememberName(); router.push('/guess-who/play'); }} className="w-full min-h-14 text-xl">Create Game</GuessButton>
            <div className="my-6 flex items-center gap-4 text-sm text-white/50"><hr className="flex-1 border-blue-200/20" />OR<hr className="flex-1 border-blue-200/20" /></div>
            <form onSubmit={join}><label htmlFor="guess-code" className="mb-2 block text-sm text-blue-100/70">Game code</label><div className="flex gap-2"><input id="guess-code" autoComplete="off" maxLength={5} value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setError(''); }} className={`${inputClass} uppercase font-mono`} placeholder="ABCDE" /><GuessButton type="submit" disabled={code.length !== 5} className="shrink-0">Join Game</GuessButton></div></form>
            <p role="status" className="min-h-6 mt-2 text-sm text-amber-200">{error}</p>
            <p className="mt-5 text-sm text-white/55">Celebrities, animals, foods, or a surprise category.<br />Play with text chat, or talk in person or on a call.</p>
            <Link href="/" className="mt-7 inline-block text-sm text-blue-200 underline">Back to Trivia World</Link>
        </div>
    </section>;
}
