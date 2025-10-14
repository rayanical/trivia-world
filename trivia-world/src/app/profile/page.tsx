'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import imageCompression from 'browser-image-compression';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';

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

/**
 * Renders the authenticated user's profile dashboard with account management and statistics.
 * @returns Profile management view including avatar upload, username edit, and game stats.
 */
export default function ProfilePage() {
    const router = useRouter();
    const { user, profile: authProfile, loading: authLoading, refreshProfile } = useAuth();
    const { showAlert } = useAlert();
    const showAlertRef = useRef(showAlert);

    const [stats, setStats] = useState<UserStats | null>(null);
    const [fetchingData, setFetchingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [newUsername, setNewUsername] = useState('');
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isEditingUsername, setIsEditingUsername] = useState(false);

    const [activeTab, setActiveTab] = useState<'general' | 'solo' | 'multiplayer'>('general');

    useEffect(() => {
        showAlertRef.current = showAlert;
    }, [showAlert]);

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

                /**
                 * Retrieves detailed gameplay statistics for the logged-in user from Supabase.
                 * Returns solo and multiplayer aggregates for display across the dashboard tabs.
                 */
                const { data: statsData, error: statsError } = await supabase.from('user_stats').select('*').eq('user_id', user.id).single();

                if (statsError && (statsError as { code?: string }).code !== 'PGRST116') {
                    throw statsError;
                }

                setStats((statsData as UserStats) || null);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load user data.';
                setError(message);
                showAlertRef.current(message);
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

    /**
     * Calculates a percentage helper for statistic cards while guarding division by zero.
     * @param num - The numerator count, typically correct answers.
     * @param denom - The denominator count, typically total attempts.
     * @returns Formatted percentage or em dash when denominator is zero.
     */
    const percent = (num: number, denom: number) => (denom === 0 ? '—' : `${Math.round((num / denom) * 100)}%`);

    /**
     * Persists username edits for the current user profile and refreshes cached context data.
     */
    const handleUpdateProfile = async () => {
        if (!user) return;
        setSaving(true);
        setError(null);
        try {
            /**
             * Updates the Supabase `profiles` table with the new display name for the user.
             */
            const { error: updateError } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', user.id);
            if (updateError) throw updateError;
            await refreshProfile();
            setIsEditingUsername(false);
            showAlert('Username updated successfully!', 'success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update profile';
            showAlert(message);
        } finally {
            setSaving(false);
        }
    };

    /**
     * Uploads a new avatar to Supabase Storage and synchronizes the public profile reference.
     * @param file - The selected image file chosen by the user.
     */
    const handleAvatarUpload = async (file: File) => {
        if (!user) return;
        setUploadingAvatar(true);
        setError(null);
        try {
            if (authProfile?.avatar_url) {
                const oldAvatarPath = authProfile.avatar_url.split('/avatars/').pop();
                if (oldAvatarPath) {
                    /**
                     * Removes the previous avatar asset from Supabase Storage to avoid orphaned files.
                     */
                    await supabase.storage.from('avatars').remove([oldAvatarPath]);
                }
            }

            let fileToUpload = file;

            if (file.type !== 'image/gif') {
                const options = { maxSizeMB: 2, maxWidthOrHeight: 1024, useWebWorker: true };
                const compressedFile = await imageCompression(file, options);
                fileToUpload = compressedFile;
            }

            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
            const path = `${user.id}/${Date.now()}_${cleanFileName}`;

            /**
             * Stores the optimized avatar image in Supabase Storage under the user's namespace.
             */
            const { error: uploadError } = await supabase.storage.from('avatars').upload(path, fileToUpload);

            if (uploadError) throw uploadError;
            /**
             * Resolves a public URL for the newly uploaded avatar file to use in the profile record.
             */
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
            const publicUrl = (urlData as { publicUrl?: string } | null)?.publicUrl || '';
            /**
             * Saves the avatar URL to the user's profile so it propagates across the application.
             */
            const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
            if (updateError) throw updateError;
            setAvatarPreview(publicUrl);
            await refreshProfile();
            showAlert('Avatar updated successfully!', 'success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload avatar';
            showAlert(message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    /**
     * Requests a Supabase password reset email for the current account.
     */
    const handlePasswordReset = async () => {
        try {
            const email = user?.email || userEmail;
            if (!email) {
                showAlert('No email available for the current user.');
                return;
            }
            /**
             * Initiates Supabase Auth password recovery.
             * The `redirectTo` option tells Supabase the exact URL
             * for the button in the password reset email.
             */
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (resetError) throw resetError;
            showAlert('Password reset email sent!', 'success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send reset email';
            showAlert(message);
        }
    };

    /**
     * Signs the user out via Supabase Auth and returns to the homepage.
     */
    const handleLogout = async () => {
        /**
         * Clears Supabase Auth session tokens to complete sign-out.
         */
        await supabase.auth.signOut();
        router.push('/');
    };

    /**
     * Navigates back to the landing page without altering authentication state.
     */
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
        <div className="min-h-screen bg-[#101710] text-white p-4 md:p-6">
            <header className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
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
                <section className="md:col-span-1 bg-white/5 rounded-lg p-6 flex flex-col items-center gap-4">
                    <h2 className="text-xl font-semibold">Account</h2>

                    <div className="flex flex-col items-center gap-3 w-full">
                        <div className="w-28 h-28 rounded-full overflow-hidden bg-white/6 flex items-center justify-center">
                            {avatarPreview ? (
                                // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
                                <img src={avatarPreview} alt="avatar-preview" className="w-full h-full object-cover" />
                            ) : authProfile?.avatar_url ? (
                                <Image src={authProfile.avatar_url} alt="avatar" width={112} height={112} className="object-cover" />
                            ) : (
                                <Image src="/file.svg" alt="default avatar" width={112} height={112} className="object-cover object-center transform scale-80" />
                            )}
                        </div>
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
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            className="w-full p-2 rounded-md bg-blue-700 hover:bg-blue-600 cursor-pointer disabled:opacity-60"
                        >
                            {uploadingAvatar ? 'Uploading…' : 'Upload Avatar'}
                        </button>

                        <div className="w-full mt-4">
                            <label className="block mb-1 text-sm text-gray-400">Username</label>
                            {isEditingUsername ? (
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        className="w-full p-2 rounded-md bg-white/6 outline-none focus:ring-2 focus:ring-green-600"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleUpdateProfile}
                                            disabled={saving}
                                            className="flex-1 p-2 rounded-md bg-green-800 hover:bg-green-900 disabled:opacity-60 cursor-pointer"
                                        >
                                            {saving ? 'Saving…' : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditingUsername(false);
                                                setNewUsername(authProfile?.username || '');
                                            }}
                                            className=" cursor-pointer flex-1 p-2 rounded-md bg-gray-700 hover:bg-gray-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <p className="text-lg">{authProfile?.username || '—'}</p>
                                    <button onClick={() => setIsEditingUsername(true)} className="text-sm text-green-400 hover:underline cursor-pointer">
                                        Change
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="w-full mt-2">
                            <label className="block mb-1 text-sm text-gray-400">Email</label>
                            <p className="text-lg text-gray-300">{userEmail ?? '—'}</p>
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
                <section className="md:col-span-2 bg-white/5 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Statistics</h2>
                        <div className="flex flex-wrap gap-3">
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
                                <div className="text-xl sm:text-2xl font-bold">{safeStats.solo_questions_answered}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Total Multiplayer Answered</div>
                                <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_questions_answered}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Games Played</div>
                                <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_games_played}</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'solo' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Questions Answered</div>
                                <div className="text-xl sm:text-2xl font-bold">{safeStats.solo_questions_answered}</div>
                                <div className="text-sm text-gray-400">
                                    Correct: {safeStats.solo_questions_correct} ({percent(safeStats.solo_questions_correct, safeStats.solo_questions_answered)})
                                </div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Easy Correct</div>
                                <div className="text-xl sm:text-2xl font-bold text-green-400">{safeStats.solo_easy_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Medium Correct</div>
                                <div className="text-xl sm:text-2xl font-bold text-yellow-400">{safeStats.solo_medium_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Hard Correct</div>
                                <div className="text-xl sm:text-2xl font-bold text-red-400">{safeStats.solo_hard_correct}</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'multiplayer' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Matches Played</div>
                                <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_games_played}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Matches Won</div>
                                <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_games_won}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Multiplayer Correct</div>
                                <div className="text-xl sm:text-2xl font-bold">{safeStats.multiplayer_questions_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Easy Correct</div>
                                <div className="text-xl sm:text-2xl font-bold text-green-400">{safeStats.multiplayer_easy_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Medium Correct</div>
                                <div className="text-xl sm:text-2xl font-bold text-yellow-400">{safeStats.multiplayer_medium_correct}</div>
                            </div>
                            <div className="p-4 rounded-md bg-white/6">
                                <div className="text-sm text-gray-300">Hard Correct</div>
                                <div className="text-xl sm:text-2xl font-bold text-red-400">{safeStats.multiplayer_hard_correct}</div>
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
