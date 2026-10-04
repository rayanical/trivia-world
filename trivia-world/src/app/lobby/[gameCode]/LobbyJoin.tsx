'use client';
import dynamic from 'next/dynamic';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
const AuthModal = dynamic(() => import('@/app/components/AuthModal'), { ssr: false });
type LobbyViewProps = Pick<ReturnType<typeof useLobbyGame>, 'router' | 'gameCode' | 'guestName' | 'setGuestName' | 'joining' | 'isAuthModalOpen' | 'setIsAuthModalOpen' | 'profile' | 'joinLobby' | 'roomError'>;
export default function LobbyJoin({ router, gameCode, guestName, setGuestName, joining, isAuthModalOpen, setIsAuthModalOpen, profile, joinLobby, roomError }: LobbyViewProps) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#101710] text-white p-4">
                <div className="w-full max-w-md space-y-6">
                    <h1 className="text-4xl font-bold text-center">Join Lobby</h1>
                    <p className="text-center text-white/80">
                        Enter your name to join game: <span className="font-bold text-green-400">{gameCode}</span>
                    </p>

                    <label htmlFor="lobby-name" className="block text-white">Your name</label>
                    <input
                        id="lobby-name" autoComplete="nickname"
                        className="w-full h-14 px-6 rounded-md bg-white/5 border border-white/20 text-white placeholder-white/60 text-center text-lg focus:ring-2 focus:ring-green-800"
                        placeholder="Enter Your Name"
                        type="text"
                        maxLength={15}
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && guestName.trim()) {
                                void joinLobby();
                            }
                        }}
                    />

                    <div className="min-h-12 text-sm text-yellow-200" role="status">{roomError}</div>
                    <button
                        onClick={() => void joinLobby()}
                        disabled={joining || (!profile?.username && !guestName.trim())}
                        className="w-full h-14 rounded-md bg-green-800 hover:bg-green-900 text-white text-xl font-bold disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                        {joining ? 'Joining…' : 'Join Game'}
                    </button>

                    <button onClick={() => router.push('/')} className="w-full h-12 rounded-md bg-gray-700 hover:bg-gray-800 text-white font-bold cursor-pointer transition-colors">
                        Back to Home
                    </button>

                    <div className="flex items-center gap-4 my-6">
                        <hr className="flex-grow border-white/20" />
                        <span className="text-white/60 text-sm">OR</span>
                        <hr className="flex-grow border-white/20" />
                    </div>

                    <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="w-full h-12 rounded-md bg-blue-800 hover:bg-blue-900 text-white font-bold cursor-pointer transition-colors"
                    >
                        Login/Signup
                    </button>
                </div>
                {isAuthModalOpen && <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />}
            </div>
        );
}
