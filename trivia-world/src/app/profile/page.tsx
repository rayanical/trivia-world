'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import imageCompression from 'browser-image-compression';
import { useAuth } from '@/context/AuthContext';

type UserStats = {
    solo_questions_answered: number;
    solo_questions_correct: number;
    solo_easy_correct: number;
    solo_medium_correct: number;
    solo_hard_correct: number;
    multiplayer_games_played: number;
    multiplayer_games_won: number;
    multiplayer_questions_answered: number;
    multiplayer_questions_correct: number;
    multiplayer_easy_correct: number;
    multiplayer_medium_correct: number;
    multiplayer_hard_correct: number;
};

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile: authProfile, loading: authLoading, refreshProfile } = useAuth();

    const [stats, setStats] = useState<UserStats | null>(null);
    const [fetchingData, setFetchingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [newUsername, setNewUsername] = useState('');
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'general' | 'solo' | 'multiplayer'>('general');

    useEffect(() => {
        if (authLoading) {
            return;
        }
        if (!user) {
            router.push('/');
            return;
        }

        const fetchData = async () => {
            setFetchingData(true);
            setError(null);
            try {
                setUserEmail(user.email || null);
                setNewUsername(authProfile?.username || '');
                setAvatarPreview(authProfile?.avatar_url || null);

                const { data: statsData, error: statsError } = await supabase.from('user_stats').select('*').eq('user_id', user.id).single();

                if (statsError && (statsError as { code?: string }).code !== 'PGRST116') {
                    throw statsError;
                }

                setStats((statsData as UserStats) || null);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load user data.';
                setError(message);
            } finally {
                setFetchingData(false);
            }
        };

        fetchData();
    }, [authLoading, authProfile, router, user]);

    const safeStats = useMemo<UserStats>(() => {
        return (
            stats || {
                solo_questions_answered: 0,
                solo_questions_correct: 0,
                solo_easy_correct: 0,
                solo_medium_correct: 0,
                solo_hard_correct: 0,
                multiplayer_games_played: 0,
                multiplayer_games_won: 0,
                multiplayer_questions_answered: 0,
                multiplayer_questions_correct: 0,
                multiplayer_easy_correct: 0,
                multiplayer_medium_correct: 0,
                multiplayer_hard_correct: 0,
            }
        );
    }, [stats]);

    const percent = (num: number, denom: number) => (denom === 0 ? '—' : `${Math.round((num / denom) * 100)}%`);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setSaving(true);
        setError(null);
        try {
            const { error: updateError } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', user.id);
            if (updateError) throw updateError;
            await refreshProfile();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update profile';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        if (!user) return;
        setUploadingAvatar(true);
        setError(null);
        try {
            const options = { maxSizeMB: 2, maxWidthOrHeight: 1024, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
            const path = `${user.id}/${Date.now()}_${cleanFileName}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(path, compressedFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
            const publicUrl = (urlData as { publicUrl?: string } | null)?.publicUrl || '';
            const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
            if (updateError) throw updateError;
            setAvatarPreview(publicUrl);
            await refreshProfile();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload avatar';
            setError(message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handlePasswordReset = async () => {
        setError(null);
        try {
            const email = user?.email || userEmail;
            if (!email) {
                setError('No email available for the current user.');
                return;
            }
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
            if (resetError) throw resetError;
            alert('Password reset email sent!');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send reset email';
            setError(message);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleBackHome = () => router.push('/');

    if (authLoading || fetchingData) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#101710] text-white">
                <div>Loading profile…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#101710] text-white">
                <div className="text-red-400">{error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#101710] text-white p-6">
            <header className="max-w-5xl mx-auto flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={handleBackHome} className="text-sm px-3 py-1 rounded-md bg-white/6 hover:bg-white/10 cursor-pointer">
                        ← Home
                    </button>
                    <h1 className="text-3xl font-bold">Your Profile</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleLogout} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 cursor-pointer">
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Profile form */}
                <section className="md:col-span-1 bg-white/5 rounded-lg p-6 flex flex-col items-center gap-4">
                    <h2 className="text-xl font-semibold">Account</h2>

                    <div className="flex flex-col items-center gap-3 w-full">
                        <div className="w-28 h-28 rounded-full overflow-hidden bg-white/6 flex items-center justify-center">
                            {avatarPreview ? (
                                // eslint-disable-next-line @next/next/no-img-element -- local data URL preview, ok to use native img
                                <img src={avatarPreview} alt="avatar-preview" className="w-full h-full object-cover" />
                            ) : authProfile?.avatar_url ? (
                                <Image src={authProfile.avatar_url} alt="avatar" width={112} height={112} className="object-cover" />
                            ) : (
                                <Image src="/file.svg" alt="default avatar" width={112} height={112} className="object-cover" />
                            )}
                        </div>

                        <div className="w-full">
                            <label className="block mb-1 text-sm">Username</label>
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="w-full p-2 rounded-md bg-white/6 mb-2 outline-none focus:ring-2 focus:ring-green-600"
                            />
                        </div>

                        <div className="w-full text-sm text-gray-300">Email: {userEmail ?? '—'}</div>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={handleUpdateProfile}
                                disabled={saving}
                                className="flex-1 p-2 rounded-md bg-green-800 hover:bg-green-900 cursor-pointer disabled:opacity-60"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                onClick={() => {
                                    setNewUsername(authProfile?.username || '');
                                    setAvatarPreview(authProfile?.avatar_url || null);
                                }}
                                className="flex-1 p-2 rounded-md bg-gray-700 hover:bg-gray-600 cursor-pointer"
                            >
                                Reset
                            </button>
                        </div>

                        <div className="w-full">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg, image/png, image/webp, image/gif"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => setAvatarPreview(String(reader.result));
                                    reader.readAsDataURL(file);
                                    void handleAvatarUpload(file);
                                }}
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingAvatar}
                                    className="flex-1 p-2 rounded-md bg-blue-700 hover:bg-blue-600 cursor-pointer"
                                >
                                    {uploadingAvatar ? 'Uploading…' : 'Upload Avatar'}
                                </button>
                                <button
                                    onClick={() => {
                                        setAvatarPreview(authProfile?.avatar_url || null);
                                    }}
                                    className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>

                        <hr className="my-3 border-white/6 w-full" />

                        <div className="w-full">
                            <h3 className="text-lg font-medium mb-2">Security</h3>
                            <div className="text-sm mb-2">Reset Password</div>
                            <button onClick={handlePasswordReset} className="w-full p-2 rounded-md bg-yellow-500 hover:bg-yellow-400 cursor-pointer">
                                Send Reset Email
                            </button>
                        </div>
                    </div>
                </section>

                {/* Right: Stats */}
                <section className="md:col-span-2 bg-white/5 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Statistics</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('general')}
                                className={`px-3 py-1 rounded-md cursor-pointer ${activeTab === 'general' ? 'bg-green-800' : 'bg-white/6'}`}
                            >
                                General
                            </button>
                            <button
                                onClick={() => setActiveTab('solo')}
                                className={`px-3 py-1 rounded-md cursor-pointer ${activeTab === 'solo' ? 'bg-yellow-500 text-black' : 'bg-white/6'}`}
                            >
                                Solo
                            </button>
                            <button
                                onClick={() => setActiveTab('multiplayer')}
                                className={`px-3 py-1 rounded-md cursor-pointer ${activeTab === 'multiplayer' ? 'bg-red-600' : 'bg-white/6'}`}
                            >
                                Multiplayer
                            </button>
                        </div>
                    </div>

                    {activeTab === 'general' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Total Solo Answered</div>
                                <div className="text-2xl font-bold">{safeStats.solo_questions_answered}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Total Multiplayer Answered</div>
                                <div className="text-2xl font-bold">{safeStats.multiplayer_questions_answered}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Games Played</div>
                                <div className="text-2xl font-bold">{safeStats.multiplayer_games_played}</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'solo' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Questions Answered</div>
                                <div className="text-2xl font-bold">{safeStats.solo_questions_answered}</div>
                                <div className="text-sm text-gray-400">
                                    Correct: {safeStats.solo_questions_correct} ({percent(safeStats.solo_questions_correct, safeStats.solo_questions_answered)})
                                </div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Easy Correct</div>
                                <div className="text-2xl font-bold text-green-400">{safeStats.solo_easy_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Medium Correct</div>
                                <div className="text-2xl font-bold text-yellow-400">{safeStats.solo_medium_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Hard Correct</div>
                                <div className="text-2xl font-bold text-red-400">{safeStats.solo_hard_correct}</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'multiplayer' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Matches Played</div>
                                <div className="text-2xl font-bold">{safeStats.multiplayer_games_played}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Matches Won</div>
                                <div className="text-2xl font-bold">{safeStats.multiplayer_games_won}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Multiplayer Correct</div>
                                <div className="text-2xl font-bold">{safeStats.multiplayer_questions_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Easy Correct</div>
                                <div className="text-2xl font-bold text-green-400">{safeStats.multiplayer_easy_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Medium Correct</div>
                                <div className="text-2xl font-bold text-yellow-400">{safeStats.multiplayer_medium_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Hard Correct</div>
                                <div className="text-2xl font-bold text-red-400">{safeStats.multiplayer_hard_correct}</div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <h3 className="text-lg font-medium mb-2">Details</h3>
                        <div className="p-4 rounded-md bg-white/6">
                            <div className="text-sm text-gray-300">Solo accuracy</div>
                            <div className="text-xl font-bold">{percent(safeStats.solo_questions_correct, safeStats.solo_questions_answered)}</div>

                            <div className="mt-4 text-sm text-gray-300">Multiplayer accuracy</div>
                            <div className="text-xl font-bold">{percent(safeStats.multiplayer_questions_correct, safeStats.multiplayer_questions_answered)}</div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
