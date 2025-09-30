// app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import AuthModal from './components/AuthModal';
import { supabase } from '@/lib/supabaseClient'; // Already there
export default function WelcomePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [gameCode, setGameCode] = useState('');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    useEffect(() => {
        const onGameCreated = (newGameCode: string) => {
            router.push(`/lobby/${newGameCode}`);
        };
        socket.on('game-created', onGameCreated);
        return () => {
            socket.off('game-created', onGameCreated);
        };
    }, [router]);
    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);
    // Action 1: Play Solo
    const handlePlaySolo = () => {
        const playerName = name.trim() === '' ? 'Guest' : name.trim();
        sessionStorage.setItem('playerName', playerName);
        router.push('/solo');
    };

    // Action 2: Create Multiplayer Game
    const handleCreateMultiplayerGame = () => {
        // Name is optional now — default to 'Guest' when empty
        const playerName = name.trim() === '' ? 'Guest' : name.trim();
        sessionStorage.setItem('playerName', playerName);
        socket.emit('create-game', playerName);
    };

    // Action 3: Join Multiplayer Game
    const handleJoinMultiplayerGame = () => {
        // Name is optional now — default to 'Guest' when empty
        const playerName = name.trim() === '' ? 'Guest' : name.trim();
        if (gameCode) {
            // Validate game code format: 5 alphanumeric characters (A-Z,0-9)
            const validCode = /^[A-Z0-9]{5}$/;
            if (!validCode.test(gameCode)) {
                alert('Invalid game code format. Please enter a 5-character code (letters and numbers).');
                return;
            }

            sessionStorage.setItem('playerName', playerName);
            // Ask the server to join — server will reply with success or error
            socket.emit('join-game', { gameCode, playerName });

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

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-[#101710]">
            <div className="absolute top-4 right-4">
                {user ? (
                    <button onClick={() => router.push('/profile')} className="bg-blue-800 p-2 rounded-md text-white">
                        Profile
                    </button>
                ) : (
                    <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-800 p-2 rounded-md text-white">
                        Login/Signup
                    </button>
                )}
            </div>
            <main className="flex flex-1 flex-col items-center justify-center py-16 px-4">
                <div className="flex flex-col items-center w-full max-w-2xl text-center">
                    <h1 className="text-white text-5xl md:text-6xl font-bold tracking-tighter">Trivia World</h1>
                    <p className="text-white/80 text-lg md:text-xl max-w-2xl my-8">The ultimate trivia challenge. Choose your way to play.</p>

                    <input
                        className="w-full max-w-md h-14 px-6 mb-8 rounded-md bg-white/5 border border-white/20 text-white placeholder-white/60 text-center text-lg focus:ring-2 focus:ring-primary"
                        placeholder="Enter Your Name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

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
