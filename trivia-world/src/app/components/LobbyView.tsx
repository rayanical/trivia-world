'use client';
import dynamic from 'next/dynamic';
import type { useLobbyGame } from '@/hooks/useLobbyGame';
import LobbyJoin from '@/app/lobby/[gameCode]/LobbyJoin';
import LobbyResults from '@/app/lobby/[gameCode]/LobbyResults';
import LobbySetup from '@/app/lobby/[gameCode]/LobbySetup';
import LobbyQuestion from '@/app/lobby/[gameCode]/LobbyQuestion';
const AuthModal = dynamic(() => import('@/app/components/AuthModal'), { ssr: false });

type Props = { game: ReturnType<typeof useLobbyGame>; creator?: boolean; connectionMessage?: string | null; retryConnection?: () => void; retryLabel?: string };
export default function LobbyView({ game, creator = false, connectionMessage, retryConnection, retryLabel }: Props) {
    if (!creator && !game.joined) return <LobbyJoin {...game} />;
    if (game.showGameOver) return <LobbyResults {...game} />;
    return (
        <div className="flex min-h-svh flex-col items-center justify-start lg:justify-center bg-[#101710] px-4 pb-8 pt-20 text-white relative">
            <div className="absolute top-4 right-4 z-10">
                {game.user ? <button onClick={() => game.router.push('/profile')} className="px-3 py-2 text-sm font-semibold rounded-md bg-blue-800 hover:bg-blue-900 text-white transition-colors cursor-pointer">Profile</button>
                    : <button onClick={() => game.setIsAuthModalOpen(true)} className="px-3 py-2 text-sm font-semibold rounded-md bg-green-800 hover:bg-green-900 text-white transition-colors cursor-pointer">Login/Signup</button>}
            </div>
            {game.isAuthModalOpen && <AuthModal isOpen onClose={() => game.setIsAuthModalOpen(false)} />}
            {game.inGame ? <LobbyQuestion {...game} /> : <LobbySetup {...game} connectionMessage={connectionMessage || (game.gameCode && !game.multiplayerConnected ? 'Reconnecting in the background. Your settings are unchanged.' : null)} retryConnection={retryConnection} retryLabel={retryLabel} />}
        </div>
    );
}
