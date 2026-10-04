'use client';
import { useAuth } from '@/context/AuthContext';
import { useSoloSaveState } from '@/hooks/useSoloSaveState';
export default function SoloSaveStatus() {
    const { user } = useAuth();
    const state = useSoloSaveState();
    if (state.failed) return <p role="status" className="mt-3 text-sm text-yellow-300">Some answers could not be saved. Your score here is unchanged; saved statistics may be incomplete.</p>;
    if (!state.pending || !user) return null;
    return <p role="status" className="mt-3 text-sm text-white/60">Saving {state.pending} {state.pending === 1 ? 'answer' : 'answers'} in the background…</p>;
}
