'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import type { Socket } from 'socket.io-client';
import { useAlert } from './AlertContext';
import { usePathname } from 'next/navigation';

export type Profile = { username: string | null; avatar_url: string | null };
export type User = { id: string; email: string; name: string; image?: string | null };
type AuthContextValue = { user: User | null; profile: Profile | null; loading: boolean; refreshProfile: () => Promise<void>; requireServer: (multiplayer?: boolean) => boolean; connectMultiplayer: (signal?: AbortSignal) => Promise<boolean>; multiplayerConnected: boolean };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { data: session, isPending, error, refetch } = authClient.useSession();
    const { showAlert } = useAlert();
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const token = session?.session.token;
    const pathname = usePathname();
    const [multiplayerRequested, setMultiplayerRequested] = useState(false);
    const wantsMultiplayer = pathname.startsWith('/lobby/') || (pathname === '/' && multiplayerRequested);
    useEffect(() => { setMultiplayerRequested(false); }, [pathname]);
    const profile = useMemo<Profile | null>(() => session ? { username: session.user.name, avatar_url: session.user.image || null } : null, [session]);
    const refreshProfile = useCallback(async () => { await refetch(); }, [refetch]);

    // The session request wakes Render without blocking the page. Retry quietly if
    // a cold start outlasts the proxy timeout, instead of leaving the app stuck.
    useEffect(() => {
        if (!error) return;
        const timer = setTimeout(() => { void refetch(); }, 5_000);
        return () => clearTimeout(timer);
    }, [error, refetch]);

    useEffect(() => {
        if (isPending || error || !wantsMultiplayer) return;
        let disposed = false;
        let cleanup: (() => void) | undefined;
        void import('@/lib/socket').then(({ socket, guestId }) => {
            if (disposed) return;
            socketRef.current = socket;
            const onConnect = () => setConnected(true);
            const onDisconnect = () => setConnected(false);
            socket.on('connect', onConnect);
            socket.on('disconnect', onDisconnect);
            socket.auth = { token, guestId: guestId() };
            setConnected(socket.connected);
            socket.connect();
            cleanup = () => {
                socket.off('connect', onConnect);
                socket.off('disconnect', onDisconnect);
                socket.disconnect();
                setConnected(false);
            };
        }).catch(() => { if (!disposed) showAlert('Could not load multiplayer. Please reload and try again.'); });
        return () => { disposed = true; cleanup?.(); };
    }, [isPending, error, token, wantsMultiplayer, showAlert]);

    const requireServer = useCallback((multiplayer = false) => {
        if (!isPending && !error && (!multiplayer || (connected && socketRef.current?.connected))) return true;
        showAlert(error
            ? 'The server is temporarily unavailable. Reconnecting in the background. Please try again shortly.'
            : isPending ? 'The server is waking up. Please try again in a moment.'
            : 'Connecting to the game server. Please try again in a moment.', 'warning');
        return false;
    }, [isPending, error, connected, showAlert]);

    const connectMultiplayer = useCallback(async (signal?: AbortSignal) => {
        if (signal?.aborted) return false;
        if (!requireServer()) return false;
        const { socket, guestId } = await import('@/lib/socket');
        if (signal?.aborted) return false;
        socketRef.current = socket;
        setMultiplayerRequested(true);
        socket.auth = { token, guestId: guestId() };
        if (socket.connected) return true;
        return new Promise<boolean>((resolve) => {
            const finish = (ready: boolean) => {
                clearTimeout(timer);
                socket.off('connect', onConnect);
                socket.off('connect_error', onError);
                signal?.removeEventListener('abort', onAbort);
                if (!ready) {
                    setMultiplayerRequested(false);
                    socket.disconnect();
                    if (!signal?.aborted) showAlert('Could not connect to the game server. Please try again shortly.', 'warning');
                }
                resolve(ready);
            };
            const onAbort = () => finish(false);
            const onConnect = () => { setConnected(true); finish(true); };
            const onError = () => finish(false);
            const timer = setTimeout(onError, 15_000);
            signal?.addEventListener('abort', onAbort, { once: true });
            socket.once('connect', onConnect);
            socket.once('connect_error', onError);
            socket.connect();
        });
    }, [requireServer, token, showAlert]);

    const value = useMemo<AuthContextValue>(() => ({
        user: session?.user || null,
        profile,
        loading: isPending,
        refreshProfile,
        requireServer,
        connectMultiplayer,
        multiplayerConnected: connected,
    }), [session, profile, isPending, refreshProfile, requireServer, connectMultiplayer, connected]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
