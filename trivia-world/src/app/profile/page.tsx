'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { authClient } from '@/lib/auth-client';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import ProfileStats, { type UserStats } from './ProfileStats';


/**
 * Renders the authenticated user's profile dashboard with account management and statistics.
 * @returns Profile management view including avatar upload, username edit, and game stats.
 */
export default function ProfilePage() {
    const { user } = useAuth();
    return <ProfileContent key={user?.id || 'guest'} />;
}

function ProfileContent() {
    const router = useRouter();
    const { user, profile: authProfile, loading: authLoading, refreshProfile } = useAuth();
    const { showAlert } = useAlert();

    const [stats, setStats] = useState<UserStats | null>(null);
    const [fetchingData, setFetchingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [newUsername, setNewUsername] = useState('');
    const userEmail = user?.email || null;
    const [retry, setRetry] = useState(0);
    const userId = user?.id;
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isEditingUsername, setIsEditingUsername] = useState(false);


    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        let ignore = false;
        setFetchingData(true);
        setError(null);
        api<UserStats>('/stats', { signal: controller.signal })
            .then(data => {
                if (ignore) return;
                setStats(data);
            })
            .catch(err => {
                if (ignore) return;
                setError(err instanceof Error ? err.message : 'Failed to load statistics.');
            })
            .finally(() => {
                if (ignore) return;
                setFetchingData(false);
            });
        return () => { ignore = true; controller.abort(); };
    }, [userId, retry]);

    /**
     * Persists username edits for the current user profile and refreshes cached context data.
     */
    const handleUpdateProfile = async () => {
        if (!user) return;
        setSaving(true);
        setError(null);
        try {
            await api('/profile', jsonBody({ username: newUsername.trim() }));
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
     * Uploads a new avatar to the database and synchronizes the public profile reference.
     * @param file - The selected image file chosen by the user.
     */
    const handleAvatarUpload = async (file: File) => {
        if (!user) return;
        setUploadingAvatar(true);
        setError(null);
        try {
            if (file.size > 2 * 1024 * 1024) throw new Error('Choose an image smaller than 2 MB.');
            const result = await api<{ avatar_url: string }>('/avatar', {
                method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
            });
            setAvatarPreview(result.avatar_url);
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
     * Requests a Better Auth password reset email for the current account.
     */
    const handlePasswordReset = async () => {
        try {
            const email = user?.email || userEmail;
            if (!email) {
                showAlert('No email available for the current user.');
                return;
            }
            const { error: resetError } = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
            if (resetError) throw new Error(resetError.message || 'Could not request a reset email.');
            showAlert('If an account exists, a reset link will arrive shortly.', 'success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send reset email';
            showAlert(message);
        }
    };

    /**
     * Signs the user out via Better Auth and returns to the homepage.
     */
    const handleLogout = async () => {
        /**
         * Clears Better Auth session tokens to complete sign-out.
         */
        const { error } = await authClient.signOut();
        if (error) { showAlert(error.message || 'Could not sign out.'); return; }
        router.push('/');
    };
    const handleBackHome = () => router.push('/');

    if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-[#101710] text-white">Loading profile…</div>;
    if (!user) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-white bg-[#101710]">
        <p>Sign in to view your profile.</p><button onClick={handleBackHome} className="p-3 rounded-md bg-green-800">Back to Home</button>
    </div>;

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
                                <Image src={avatarPreview} alt="Your avatar" width={112} height={112} className="w-full h-full object-cover" />
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
                                e.target.value = '';
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
                            <p className="block mb-1 text-sm text-gray-400">Username</p>
                            {isEditingUsername ? (
                                <div className="flex flex-col gap-2">
                                    <input
                                        id="profile-username" aria-label="Username" maxLength={15}
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
                                    <button onClick={() => { setNewUsername(authProfile?.username || ''); setIsEditingUsername(true); }} className="text-sm text-green-400 hover:underline cursor-pointer">
                                        Change
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="w-full mt-2">
                            <p className="block mb-1 text-sm text-gray-400">Email</p>
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
                <ProfileStats stats={stats} loading={fetchingData} error={error} onRetry={() => setRetry(value => value + 1)} />
            </main>
        </div>
    );
}
