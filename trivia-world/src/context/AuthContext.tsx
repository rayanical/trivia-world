'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import { guestId, socket } from '@/lib/socket';

export type Profile = { username: string | null; avatar_url: string | null };
export type User = { id: string; email: string; name: string; image?: string | null };
type AuthContextValue = { user: User | null; profile: Profile | null; loading: boolean; refreshProfile: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { data: session, isPending, refetch } = authClient.useSession();
    const token = session?.session.token;
    const refreshProfile = useCallback(async () => { await refetch(); }, [refetch]);

    useEffect(() => {
        if (isPending) return;
        socket.auth = { token, guestId: guestId() };
        socket.connect();
        return () => { socket.disconnect(); };
    }, [isPending, token]);

    const value = useMemo<AuthContextValue>(() => ({
        user: session?.user || null,
        profile: session ? { username: session.user.name, avatar_url: session.user.image || null } : null,
        loading: isPending,
        refreshProfile,
    }), [session, isPending, refreshProfile]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
