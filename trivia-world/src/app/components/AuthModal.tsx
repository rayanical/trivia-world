// app/components/AuthModal.tsx (updated insert to upsert)
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAlert } from '@/context/AlertContext';

type AuthModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

const validatePassword = (password: string): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one special character';
    return null;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // For signup
    const [isSignup, setIsSignup] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { showAlert } = useAlert();

    const handleAuth = async () => {
        setLoading(true);
        setError(null);

        try {
            if (isSignup) {
                // Validate password
                const passwordError = validatePassword(password);
                if (passwordError) {
                    setError(passwordError);
                    setLoading(false);
                    return;
                }

                // Validate username length
                if (username.length > 15) {
                    setError('Username must be 15 characters or less');
                    setLoading(false);
                    return;
                }

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

                    showAlert('Signup successful!', 'success');
                    onClose();
                    // Optionally redirect to profile or home
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                showAlert('Signed in successfully!', 'success');
                onClose();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
            <div className="bg-gradient-to-br from-[#104423] to-[#0a2f18] p-8 rounded-xl shadow-2xl border border-green-900/30 w-full max-w-md">
                <h2 className="text-3xl font-bold text-green-400 mb-6 text-center">{isSignup ? 'Sign Up' : 'Sign In'}</h2>
                {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">{error}</div>}
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                />
                <input
                    type="password"
                    placeholder={isSignup ? 'Password (min 8 chars, 1 upper, 1 number, 1 special)' : 'Password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                />
                {isSignup && (
                    <input
                        type="text"
                        placeholder="Username (3-15 characters)"
                        value={username}
                        maxLength={15}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    />
                )}
                <div className="flex gap-4">
                    <button
                        onClick={handleAuth}
                        disabled={loading || (isSignup && username.length < 3)}
                        className="flex-1 p-3 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-lg"
                    >
                        {loading ? 'Loading...' : isSignup ? 'Sign Up' : 'Sign In'}
                    </button>
                    <button onClick={onClose} className="flex-1 p-3 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer transition-colors shadow-lg">
                        Cancel
                    </button>
                </div>
                <button onClick={() => setIsSignup(!isSignup)} className="mt-4 text-green-400 hover:text-green-300 underline w-full text-center cursor-pointer transition-colors">
                    {isSignup ? 'Switch to Sign In' : 'Switch to Sign Up'}
                </button>
            </div>
        </div>
    );
}
