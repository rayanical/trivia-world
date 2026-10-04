'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GuessButton } from './ui';
const AuthModal = dynamic(() => import('../components/AuthModal'), { ssr: false });
export default function GuessHeader() {
    const { user } = useAuth(); const router = useRouter(); const [authOpen, setAuthOpen] = useState(false);
    return <><header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/guess-who" className="font-bold text-blue-200 text-lg">Guess Who<span className="sr-only"> home</span></Link>
        <div className="flex items-center gap-2"><Link href="/" className="rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10">Back to Trivia</Link><GuessButton secondary onClick={() => user ? router.push('/profile') : setAuthOpen(true)} className="text-sm">Account</GuessButton></div>
    </header>{authOpen && <AuthModal isOpen onClose={() => setAuthOpen(false)} />}</>;
}
