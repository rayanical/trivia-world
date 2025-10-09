'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { socket } from '../lib/socket';
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
    const { user, profile, loading } = useAuth();
    const { showAlert } = useAlert();

    const resolvePlayerName = () => {
        const profileName = profile?.username?.trim();
        if (profileName) return profileName;
        const emailPrefix = user?.email?.split('@')[0]?.trim();
        if (emailPrefix) return emailPrefix;
        const manualName = name.trim();
        return manualName || 'Guest';
    };

    const resolvedAvatar = profile?.avatar_url || null;

    /**
     * Routes the player to the solo gameplay flow after saving their display name.
     */
    const handlePlaySolo = () => {
        const playerName = resolvePlayerName();
        sessionStorage.setItem('playerName', playerName);
        router.push('/solo');
    };

    /**
     * Requests creation of a new multiplayer lobby and persists the chosen avatar/name.
     */
    const handleCreateMultiplayerGame = () => {
        const playerName = resolvePlayerName();
        const player = {
            name: playerName,
            avatar: resolvedAvatar,
        };
        sessionStorage.setItem('playerName', player.name);
        socket.emit('create-game', player);
    };

    /**
     * Validates the lobby code and attempts to join an existing multiplayer game.
     */
    const handleJoinMultiplayerGame = () => {
        const playerName = resolvePlayerName();
        const player = {
            name: playerName,
            avatar: resolvedAvatar,
        };

        if (gameCode) {
            const validCode = /^[A-Z0-9]{5}$/;
            if (!validCode.test(gameCode)) {
                showAlert('Invalid game code format.');
                return;
            }

            sessionStorage.setItem('playerName', player.name);
            socket.emit('join-game', { gameCode, player });

            const onJoinSuccess = ({ gameCode: code }: { gameCode: string }) => {
                router.push(`/lobby/${code}`);
                socket.off('join-success', onJoinSuccess);
                socket.off('join-error', onJoinError);
            };

            const onJoinError = (msg: string) => {
                showAlert(msg);
                socket.off('join-success', onJoinSuccess);
                socket.off('join-error', onJoinError);
            };

            socket.on('join-success', onJoinSuccess);
            socket.on('join-error', onJoinError);
        } else {
            showAlert('Please enter a game code.', 'warning');
        }
    };

    useEffect(() => {
        const onGameCreated = (newGameCode: string) => {
            router.push(`/lobby/${newGameCode}`);
        };
        socket.on('game-created', onGameCreated);
        return () => {
            socket.off('game-created', onGameCreated);
        };
    }, [router]);

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-[#101710]">
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
            <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8 md:py-16">
                <div className="flex flex-col items-center w-full max-w-2xl text-center">
                    <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter">Trivia World</h1>
                    <p className="text-white/80 text-md sm:text-lg max-w-2xl my-8">The ultimate trivia challenge. Choose your way to play.</p>

                    <div className="w-full max-w-md min-h-[5rem] mb-8 flex items-center justify-center">
                        {loading ? (
                            <p className="text-white/60">Loading...</p>
                        ) : user ? (
                            <div className="flex items-center gap-4 w-full p-3 rounded-md bg-white/5 border border-white/20">
                                {profile?.avatar_url ? (
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden">
                                        <Image src={profile.avatar_url} alt="User Avatar" fill style={{ objectFit: 'cover' }} />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-green-800 flex items-center justify-center text-xl font-bold">
                                        {resolvePlayerName().charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-white/60">Playing as</p>
                                    <p className="text-lg font-bold text-white">{resolvePlayerName()}</p>
                                </div>
                            </div>
                        ) : (
                            <input
                                className="w-full h-14 px-6 rounded-md bg-white/5 border border-white/20 text-white placeholder-white/60 text-center text-lg focus:ring-2 focus:ring-primary"
                                placeholder="Enter Your Name (Optional)"
                                type="text"
                                maxLength={15}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        )}
                    </div>

                    <div className="w-full max-w-md flex flex-col gap-4">
                        <button
                            onClick={handlePlaySolo}
                            className="w-full flex items-center justify-center rounded-md h-12 text-lg sm:h-14 sm:text-xl px-8 bg-green-800 hover:bg-green-900 text-white font-bold gap-3 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-2xl">person</span>
                            <span className="truncate">Play Solo</span>
                        </button>

                        <button
                            onClick={handleCreateMultiplayerGame}
                            className="w-full flex items-center justify-center rounded-md h-12 text-lg sm:h-14 sm:text-xl px-8 bg-green-800 hover:bg-green-900 text-white font-bold gap-3 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-2xl">groups</span>
                            <span className="truncate">Create Multiplayer Game</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-4 my-6 w-full max-w-md">
                        <hr className="flex-grow border-white/20" />
                        <span className="text-white/60 text-sm">OR</span>
                        <hr className="flex-grow border-white/20" />
                    </div>

                    <div className="relative w-full max-w-md">
                        <input
                            className="w-full h-14 pl-6 pr-32 rounded-md bg-white/5 border border-white/20 text-white placeholder-white/60 focus:ring-2 focus:ring-primary"
                            placeholder="Enter Game Code to Join"
                            type="text"
                            value={gameCode}
                            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                        />
                        <button
                            onClick={handleJoinMultiplayerGame}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md h-10 px-3 text-xs sm:px-4 sm:text-sm bg-[#16A34A] hover:bg-[#15803D] text-white font-bold cursor-pointer disabled:bg-gray-600 disabled:cursor-not-allowed"
                            disabled={!gameCode || gameCode.length !== 5}
                        >
                            Join Game
                        </button>
                    </div>
                </div>
            </main>
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </div>
    );
}
