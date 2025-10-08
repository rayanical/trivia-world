// app/page.tsx
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import AuthModal from './components/AuthModal';
import { useAuth } from '@/context/AuthContext';

export default function WelcomePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [gameCode, setGameCode] = useState('');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const { user, profile, loading } = useAuth();

    const resolvePlayerName = () => {
        const profileName = profile?.username?.trim();
        if (profileName) return profileName;
        const emailPrefix = user?.email?.split('@')[0]?.trim();
        if (emailPrefix) return emailPrefix;
        const manualName = name.trim();
        return manualName || 'Guest';
    };

    const resolvedAvatar = profile?.avatar_url || null;

    // Action 1: Play Solo
    const handlePlaySolo = () => {
        const playerName = resolvePlayerName();
        sessionStorage.setItem('playerName', playerName);
        router.push('/solo');
    };

    // Action 2: Create Multiplayer Game
    const handleCreateMultiplayerGame = () => {
        const playerName = resolvePlayerName();
        const player = {
            name: playerName,
            avatar: resolvedAvatar,
        };
        sessionStorage.setItem('playerName', player.name);
        socket.emit('create-game', player);
    };

    // Action 3: Join Multiplayer Game
    const handleJoinMultiplayerGame = () => {
        const playerName = resolvePlayerName();
        const player = {
            name: playerName,
            avatar: resolvedAvatar,
        };

        if (gameCode) {
            const validCode = /^[A-Z0-9]{5}$/;
            if (!validCode.test(gameCode)) {
                alert('Invalid game code format.');
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
                alert(msg);
                socket.off('join-success', onJoinSuccess);
                socket.off('join-error', onJoinError);
            };

            socket.on('join-success', onJoinSuccess);
            socket.on('join-error', onJoinError);
        } else {
            alert('Please enter a game code.');
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
            <main className="flex flex-1 flex-col items-center justify-center py-16 px-4">
                <div className="flex flex-col items-center w-full max-w-2xl text-center">
                    <h1 className="text-white text-5xl md:text-6xl font-bold tracking-tighter">Trivia World</h1>
                    <p className="text-white/80 text-lg md:text-xl max-w-2xl my-8">The ultimate trivia challenge. Choose your way to play.</p>

                    {/* --- START: CONDITIONAL UI BLOCK --- */}
                    <div className="w-full max-w-md h-20 mb-8 flex items-center justify-center">
                        {loading ? (
                            <p className="text-white/60">Loading...</p>
                        ) : user ? (
                            // Logged-in user view
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
                            // Guest view
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
                    {/* --- END: CONDITIONAL UI BLOCK --- */}

                    <div className="w-full max-w-md flex flex-col gap-4">
                        <button
                            onClick={handlePlaySolo}
                            // FIX: Added bg-primary and cursor-pointer
                            className="w-full flex items-center justify-center rounded-md h-14 px-8 bg-green-800 hover:bg-green-900 text-white text-xl font-bold gap-3 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-2xl">person</span>
                            <span className="truncate">Play Solo</span>
                        </button>

                        <button
                            onClick={handleCreateMultiplayerGame}
                            // FIX: Added cursor-pointer and disabled logic for mandatory name
                            className="w-full flex items-center justify-center rounded-md h-14 px-8 bg-green-800 hover:bg-green-900 text-white text-xl font-bold gap-3 cursor-pointer "
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
                            // FIX: Added cursor-pointer and disabled logic for mandatory name
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md h-10 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold cursor-pointer disabled:bg-gray-600 disabled:cursor-not-allowed"
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
