'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import { guestId, socket } from '@/lib/socket';
import { useAlert } from './AlertContext';

export type Profile = { username: string | null; avatar_url: string | null };
export type User = { id: string; email: string; name: string; image?: string | null };
type AuthContextValue = { user: User | null; profile: Profile | null; loading: boolean; refreshProfile: () => Promise<void>; requireServer: (multiplayer?: boolean) => boolean };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { data: session, isPending, error, refetch } = authClient.useSession();
    const { showAlert } = useAlert();
    const [connected, setConnected] = useState(false);
    const token = session?.session.token;
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
        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);

    useEffect(() => {
        if (isPending || error) return;
        socket.auth = { token, guestId: guestId() };
        socket.connect();
        return () => { socket.disconnect(); };
    }, [isPending, error, token]);

    const requireServer = useCallback((multiplayer = false) => {
        if (!isPending && !error && (!multiplayer || (connected && socket.connected))) return true;
        showAlert(error
            ? 'The server is temporarily unavailable. Reconnecting in the background. Please try again shortly.'
            : isPending ? 'The server is waking up. Please try again in a moment.'
            : 'Connecting to the game server. Please try again in a moment.', 'warning');
        return false;
    }, [isPending, error, connected, showAlert]);

    const value = useMemo<AuthContextValue>(() => ({
        user: session?.user || null,
        profile,
        loading: isPending,
        refreshProfile,
        requireServer,
    }), [session, profile, isPending, refreshProfile, requireServer]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
