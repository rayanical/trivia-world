'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLobbyGame } from '@/hooks/useLobbyGame';
import LobbyView from '../components/LobbyView';

const subscribe = (changed: () => void) => {
    window.addEventListener('popstate', changed);
    return () => window.removeEventListener('popstate', changed);
};
const getSearch = () => window.location.search;
const serverSearch = () => null;

async function createRoom(signal: AbortSignal, connect: ReturnType<typeof useAuth>['connectMultiplayer'], name?: string | null, avatar?: string | null) {
    if (!await connect(signal)) throw new Error('The server is not ready yet. You can keep choosing settings and retry in a moment.');
    const { requestLobby } = await import('@/lib/lobby-request');
    const player = { name: name?.trim() || sessionStorage.getItem('playerName') || 'Guest', avatar: avatar || null };
    const code = await requestLobby('create-game', player, signal);
    return { code, player };
}
function roomCodeFromSearch(search: string | null) {
    const code = new URLSearchParams(search || '').get('room') || '';
    return /^[A-Z0-9]{5}$/.test(code) ? code : '';
}

export default function MultiplayerSetupPage() {
    const { profile, loading, connectMultiplayer } = useAuth();
    const search = useSyncExternalStore(subscribe, getSearch, serverSearch);
    const savedCode = roomCodeFromSearch(search);
    const [createdCode, setCreatedCode] = useState('');
    const gameCode = createdCode || savedCode;
    const game = useLobbyGame(gameCode, true);
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const [showConnection, setShowConnection] = useState(false);
    const name = profile?.username;
    const avatar = profile?.avatar_url;
    useEffect(() => {
        const timer = setTimeout(() => setShowConnection(true), 400);
        return () => clearTimeout(timer);
    }, []);
    useEffect(() => {
        if (loading || search === null || gameCode) return;
        const controller = new AbortController();
        let ignore = false;
        setError(null);
        void createRoom(controller.signal, connectMultiplayer, name, avatar).then(({ code, player }) => {
            if (ignore) return;
            sessionStorage.setItem('playerName', player.name);
            sessionStorage.setItem('joinedLobby', code);
            // Update the resumable URL without navigation or remounting the controls.
            window.history.replaceState(null, '', `/multiplayer?room=${code}`);
            setCreatedCode(code);
        }).catch(err => {
            if (ignore) return;
            setError(err instanceof Error ? err.message : 'Could not create a room. Please retry.');
        });
        return () => { ignore = true; controller.abort(); };
    }, [loading, search, gameCode, name, avatar, retry, connectMultiplayer]);
    const players = game.players.length ? game.players : [{ id: 'local-player', name: 'You', avatar: profile?.avatar_url || null }];
    const resetRoom = () => {
        window.history.replaceState(null, '', '/multiplayer');
        setCreatedCode(''); game.resetRoom(); setRetry(value => value + 1);
    };
    const connectionMessage = game.roomError || (gameCode ? null : error || (showConnection ? 'Connecting in the background. You can choose your settings now.' : null));
    return <LobbyView game={{ ...game, players }} creator connectionMessage={connectionMessage} retryConnection={game.roomError ? resetRoom : !gameCode && error ? () => setRetry(value => value + 1) : undefined} retryLabel={game.roomError ? 'Create New Room' : undefined} />;
}
