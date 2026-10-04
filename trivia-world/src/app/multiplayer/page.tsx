'use client';
import { useEffect, useRef, useState } from 'react';
import { redirect, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LobbySettings from '../components/LobbySettings';

type Draft = { category: string; difficulty: string; amount: string; timeLimit: string; isTimeLimitEnabled: boolean };
const defaults: Draft = { category: '', difficulty: '', amount: '10', timeLimit: '15', isTimeLimitEnabled: true };

/** Local setup renders while a real room is created; no invented room code. */
function CreatedRoom({ code }: { code: string }) { return redirect(`/lobby/${code}`); }

export default function MultiplayerSetupPage() {
    const router = useRouter();
    const { profile, loading, connectMultiplayer } = useAuth();
    const [draft, setDraft] = useState(defaults);
    const latestDraft = useRef(defaults);
    const [error, setError] = useState<string | null>(null);
    const [createdCode, setCreatedCode] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const [showConnection, setShowConnection] = useState(false);
    const name = profile?.username;
    const avatar = profile?.avatar_url;
    const update = (patch: Partial<Draft>) => {
        const next = { ...latestDraft.current, ...patch };
        latestDraft.current = next;
        setDraft(next);
    };
    useEffect(() => {
        const timer = setTimeout(() => setShowConnection(true), 400);
        return () => clearTimeout(timer);
    }, []);
    useEffect(() => {
        if (loading) return;
        const controller = new AbortController();
        let ignore = false;
        const create = async () => {
            if (!await connectMultiplayer(controller.signal)) throw new Error('The server is not ready yet. Your settings are ready; retry connecting in a moment.');
            const { requestLobby } = await import('@/lib/lobby-request');
            const player = { name: name?.trim() || sessionStorage.getItem('playerName') || 'Guest', avatar: avatar || null };
            const code = await requestLobby('create-game', player, controller.signal);
            return { code, player };
        };
        setError(null);
        void create().then(({ code, player }) => {
            if (ignore) return;
            sessionStorage.setItem('playerName', player.name);
            sessionStorage.setItem('joinedLobby', code);
            sessionStorage.setItem(`lobbyDraft:${code}`, JSON.stringify(latestDraft.current));
            setCreatedCode(code);
        }).catch(err => {
            if (ignore) return;
            setError(err instanceof Error ? err.message : 'Could not create a room. Please retry.');
        });
        return () => { ignore = true; controller.abort(); };
    }, [loading, name, avatar, retry, connectMultiplayer]);
    if (createdCode) return <CreatedRoom code={createdCode} />;

    return <main className="min-h-screen flex items-center justify-center bg-[#101710] px-4 py-16 text-white">
        <div className="w-full max-w-md space-y-6">
            <h1 className="text-4xl font-bold text-center">Setup Multiplayer</h1>
            <LobbySettings category={draft.category} setCategory={value => update({ category: value })} difficulty={draft.difficulty} setDifficulty={value => update({ difficulty: value })} amount={draft.amount} setAmount={value => update({ amount: value })} timeLimit={draft.timeLimit} setTimeLimit={value => update({ timeLimit: value })} isTimeLimitEnabled={draft.isTimeLimitEnabled} setIsTimeLimitEnabled={value => update({ isTimeLimitEnabled: value })} />
            {error ? <div role="alert" className="text-yellow-300"><p>{error}</p><button onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-md bg-green-800 px-4 py-2 text-white cursor-pointer">Retry Connection</button></div>
                : showConnection && <p role="status" className="text-sm text-white/60">Creating your room in the background. You can choose your settings now.</p>}
            <button onClick={() => router.push('/')} className="w-full h-12 rounded-md bg-gray-700 hover:bg-gray-800 font-bold cursor-pointer">Home</button>
        </div>
    </main>;
}
