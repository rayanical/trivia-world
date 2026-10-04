'use client';
import { useLobbyGame } from '@/hooks/useLobbyGame';
import LobbyView from '@/app/components/LobbyView';
export default function LobbyPage() {
    const game = useLobbyGame();
    return <LobbyView game={game} />;
}
