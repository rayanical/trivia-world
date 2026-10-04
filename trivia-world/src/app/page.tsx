'use client';

import Image from 'next/image';
import Icon from './components/Icon';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';

const AuthModal = dynamic(() => import('@/app/components/AuthModal'), { ssr: false });

/**
 * Displays the landing page for Trivia World with entry points for solo and multiplayer modes.
 * @returns The welcome screen interface with player identification and game actions.
 */
export default function WelcomePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [gameCode, setGameCode] = useState('');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const { user, profile, connectMultiplayer, loading } = useAuth();
    const { showAlert } = useAlert();
    const [pendingLobby, setPendingLobby] = useState<'join' | null>(null);
    const [showConnection, setShowConnection] = useState(false);
    useEffect(() => {
        if (!pendingLobby) { setShowConnection(false); return; }
        const timer = setTimeout(() => setShowConnection(true), 400);
        return () => clearTimeout(timer);
    }, [pendingLobby]);
    const lobbyRequest = useRef<AbortController | null>(null);
    const navigationStarted = useRef(false);
    // Returning Home with Back must leave the previous room just like the Home button.
    useEffect(() => {
        const code = sessionStorage.getItem('joinedLobby');
        if (!code) return;
        sessionStorage.removeItem('joinedLobby');
        void import('@/lib/socket').then(({ socket }) => { if (socket.connected) socket.emit('leave-game', { gameCode: code }); });
    }, []);
    useEffect(() => () => { lobbyRequest.current?.abort(); }, []);

    const resolvePlayerName = () => {
        const profileName = profile?.username?.trim();
        if (profileName) return profileName;
        const emailPrefix = user?.email?.split('@')[0]?.trim();
        if (emailPrefix) return emailPrefix;
        const manualName = name.trim();
        return manualName || 'Guest';
    };

    const resolvedAvatar = profile?.avatar_url || null;
    const preloadMultiplayer = () => { router.prefetch('/multiplayer'); void import('@/lib/lobby-request').catch(() => {}); };
    useEffect(() => { router.prefetch('/multiplayer'); }, [router]);
    const prepareSolo = () => {
        router.prefetch('/solo');
        if (!loading) void import('@/lib/solo-buffer').then(({ prefetchSoloQuestions }) => prefetchSoloQuestions(user?.id || 'guest')).catch(() => {});
    };
    const handleMultiplayer = () => {
        if (navigationStarted.current || lobbyRequest.current) return;
        navigationStarted.current = true;
        sessionStorage.setItem('playerName', resolvePlayerName());
        router.push('/multiplayer');
    };

    /**
     * Routes the player to the solo gameplay flow after saving their display name.
     */
    const handlePlaySolo = () => {
        const playerName = resolvePlayerName();
        sessionStorage.setItem('playerName', playerName);
        router.push('/solo');
    };

    const enterLobby = async () => {
        if (lobbyRequest.current) return;
        if (!/^[A-Z0-9]{5}$/.test(gameCode)) {
            showAlert('Please enter a valid five-character game code.', 'warning');
            return;
        }
        const controller = new AbortController();
        lobbyRequest.current = controller;
        setPendingLobby('join');
        try {
            if (!await connectMultiplayer(controller.signal) || controller.signal.aborted) return;
            const { requestLobby } = await import('@/lib/lobby-request');
            const player = { name: resolvePlayerName(), avatar: resolvedAvatar };
            const code = await requestLobby('join-game', { gameCode, player }, controller.signal);
            sessionStorage.setItem('playerName', player.name);
            sessionStorage.setItem('joinedLobby', code);
            router.push(`/lobby/${code}`);
        } catch (error) {
            if (!controller.signal.aborted) showAlert(error instanceof Error ? error.message : 'Could not enter the lobby.');
        } finally {
            if (!controller.signal.aborted) setPendingLobby(null);
            lobbyRequest.current = null;
        }
    };

    return (
        <div className="relative flex min-h-svh w-full flex-col bg-[#101710]">
            <div className="absolute top-4 right-4">
                {user ? (
                    <button onClick={() => router.push('/profile')} className="bg-blue-800 hover:bg-blue-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                        Profile
                    </button>
                ) : (
                    <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 hover:bg-green-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                        Login/Signup
                    </button>
                )}
            </div>
            <main className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-20 sm:px-8 sm:pb-12 sm:pt-20">
                <div className="flex flex-col items-center w-full max-w-2xl text-center">
                    <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter">Trivia World</h1>
                    <p className="text-white/80 text-md sm:text-lg max-w-2xl my-8">The ultimate trivia challenge. Choose your way to play.</p>

                    <div className="w-full max-w-md min-h-[5rem] mb-8 flex flex-col items-center justify-center">
                        {user ? (
                            <div className="flex items-center gap-4 w-full p-3 rounded-md bg-white/5 border border-white/20">
                                {profile?.avatar_url ? (
                                    <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden">
                                        <Image src={profile.avatar_url} alt="User Avatar" fill sizes="80px" style={{ objectFit: 'cover' }} />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 shrink-0 rounded-full bg-green-800 flex items-center justify-center text-xl font-bold">
                                        {resolvePlayerName().charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 text-left">
                                    <p className="text-sm text-white/60">Playing as</p>
                                    <p className="text-lg font-bold text-white break-words">{resolvePlayerName()}</p>
                                </div>
                            </div>
                        ) : (
                            <><label htmlFor="player-name" className="block mb-2 text-sm text-white/70">Your name (optional)</label><input
                                id="player-name" autoComplete="nickname"
                                className="w-full h-14 px-6 rounded-md bg-white/5 border border-white/20 text-white placeholder-white/60 text-center text-lg focus:ring-2 focus:ring-primary"
                                placeholder="Enter your name"
                                type="text"
                                maxLength={15}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            /></>
                        )}
                    </div>

                    <div className="w-full max-w-md flex flex-col gap-4">
                        <button
                            onClick={handlePlaySolo}
                            onPointerEnter={prepareSolo}
                            onFocus={prepareSolo}
                            className="w-full flex items-center justify-center rounded-md h-12 text-lg sm:h-14 sm:text-xl px-3 sm:px-8 bg-green-800 hover:bg-green-900 text-white font-bold gap-3 cursor-pointer"
                        >
                            <Icon name="person" />
                            <span className="truncate">Play Solo</span>
                        </button>

                        <button
                            onClick={handleMultiplayer}
                            onPointerEnter={preloadMultiplayer}
                            onFocus={preloadMultiplayer}
                            disabled={pendingLobby !== null}
                            className="w-full flex items-center justify-center rounded-md h-12 text-lg sm:h-14 sm:text-xl px-3 sm:px-8 bg-green-800 hover:bg-green-900 text-white font-bold gap-3 cursor-pointer"
                        >
                            <Icon name="groups" />
                            <span className="truncate">Create Multiplayer Game</span>
                        </button>
                        <button onClick={() => { sessionStorage.setItem('playerName', resolvePlayerName()); router.push('/guess-who'); }} onPointerEnter={() => router.prefetch('/guess-who')} onFocus={() => router.prefetch('/guess-who')} className="w-full flex items-center justify-center rounded-md h-12 text-lg sm:h-14 sm:text-xl px-3 sm:px-8 bg-blue-800 hover:bg-blue-900 text-white font-bold gap-3 cursor-pointer">
                            <span aria-hidden="true">?</span><span>Guess Who</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-4 my-6 w-full max-w-md">
                        <hr className="flex-grow border-white/20" />
                        <span className="text-white/60 text-sm">OR</span>
                        <hr className="flex-grow border-white/20" />
                    </div>

                    <div className="w-full max-w-md">
                        <label htmlFor="join-code" className="block mb-2 text-sm text-white/70">Game code</label>
                        <div className="relative">
                        <input
                            id="join-code" autoComplete="off" maxLength={5}
                            className="w-full h-14 pl-6 pr-32 rounded-md bg-white/5 border border-white/20 text-white placeholder-white/60 focus:ring-2 focus:ring-primary"
                            placeholder="Game code"
                            type="text"
                            value={gameCode}
                            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                        />
                        <button
                            onClick={() => void enterLobby()}
                            onPointerEnter={preloadMultiplayer}
                            onFocus={preloadMultiplayer}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md h-10 px-3 text-xs sm:px-4 sm:text-sm bg-[#16A34A] hover:bg-[#15803D] text-white font-bold cursor-pointer disabled:bg-gray-600 disabled:cursor-not-allowed"
                            disabled={pendingLobby !== null || !gameCode || gameCode.length !== 5}
                        >
                            {showConnection && pendingLobby === 'join' ? 'Connecting…' : 'Join Game'}
                        </button>
                        </div>
                    </div>
                </div>
            </main>
            {isAuthModalOpen && <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />}
        </div>
    );
}
