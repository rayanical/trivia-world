import Link from 'next/link';
import type { Metadata } from 'next';
import GuessConnection from './GuessConnection';
import GuessHeader from './GuessHeader';
export const metadata: Metadata = { title: 'Guess Who · Trivia World', description: 'Pick a secret, ask questions, and guess your friend’s card.' };
export default function GuessLayout({ children }: { children: React.ReactNode }) {
    return <GuessConnection><div data-game-theme="guess-who" className="min-h-svh bg-[#0b1526] text-white"><GuessHeader />{children}<div className="px-4 pb-6 text-center text-xs text-blue-200/60"><Link href="/guess-who/credits" className="underline hover:text-blue-200">Card artwork & credits</Link></div></div></GuessConnection>;
}
