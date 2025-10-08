'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PostgrestError, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
    username: string | null;
    avatar_url: string | null;
};

type AuthContextValue = {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('username, avatar_url').eq('id', userId).maybeSingle();

    if (error && (error as PostgrestError).code !== 'PGRST116') {
        console.error('Error loading profile', error);
        return null;
    }

    return {
        username: data?.username ?? null,
        avatar_url: data?.avatar_url ?? null,
    };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true); // Start true on initial load

    const loadProfile = useCallback(async (userId: string | null) => {
        if (!userId) {
            setProfile(null);
            return;
        }
        const nextProfile = await fetchProfile(userId);
        setProfile(nextProfile);
    }, []);

    const refreshProfile = useCallback(async () => {
        if (!user) return;
        await loadProfile(user.id);
    }, [loadProfile, user]);

    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (!currentUser) {
                setProfile(null);
            }

            // Set loading false immediately to unblock the UI
            setLoading(false);

            // Dispatch profile load async without blocking the callback
            if (currentUser) {
                setTimeout(async () => {
                    try {
                        await loadProfile(currentUser.id);
                    } catch (error) {
                        console.error('Error loading profile after auth state change:', error);
                        setProfile(null); // Fallback to clear profile on error
                    }
                }, 0);
            }
        });

        // Cleanup the listener when the component unmounts.
        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, [loadProfile]);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            profile,
            loading,
            refreshProfile,
        }),
        [loading, profile, refreshProfile, user],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export type { Profile };
