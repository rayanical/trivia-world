// app/components/AuthModal.tsx (updated insert to upsert)
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type AuthModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // For signup
    const [isSignup, setIsSignup] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        setLoading(true);
        setError(null);

        try {
            if (isSignup) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { username }, // Optional: Store username in auth.users metadata if needed
                    },
                });
                if (error) throw error;

                if (data.user) {
                    // Use upsert for profiles to avoid duplicate key errors (e.g., if trigger creates it)
                    const { error: profileError } = await supabase.from('profiles').upsert({
                        id: data.user.id,
                        username,
                        updated_at: new Date().toISOString(), // Ensure updated_at is set
                    });

                    if (profileError) throw profileError;

                    // Use upsert for user_stats (insert if not exists, update otherwise)
                    const { error: statsError } = await supabase.from('user_stats').upsert({
                        user_id: data.user.id,
                        // Defaults are 0, so upsert will insert with defaults if new
                    });

                    if (statsError) throw statsError;

                    alert('Signup successful!');
                    onClose();
                    // Optionally redirect to profile or home
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onClose();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-[#1A201A] p-8 rounded-lg shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold text-white mb-4">{isSignup ? 'Sign Up' : 'Sign In'}</h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mb-4 p-2 rounded-md bg-white/10 text-white" />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full mb-4 p-2 rounded-md bg-white/10 text-white"
                />
                {isSignup && (
                    <input
                        type="text"
                        placeholder="Username (min 3 characters)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full mb-4 p-2 rounded-md bg-white/10 text-white"
                    />
                )}
                <div className="flex gap-4">
                    <button onClick={handleAuth} disabled={loading || (isSignup && username.length < 3)} className="flex-1 p-2 rounded-md bg-green-800 text-white disabled:bg-gray-600">
                        {loading ? 'Loading...' : isSignup ? 'Sign Up' : 'Sign In'}
                    </button>
                    <button onClick={onClose} className="flex-1 p-2 rounded-md bg-gray-700 text-white">
                        Cancel
                    </button>
                </div>
                <button onClick={() => setIsSignup(!isSignup)} className="mt-4 text-blue-400 underline">
                    {isSignup ? 'Switch to Sign In' : 'Switch to Sign Up'}
                </button>
            </div>
        </div>
    );
}
