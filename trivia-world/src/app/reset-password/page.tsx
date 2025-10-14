'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAlert } from '@/context/AlertContext';

/**
 * Validates password complexity requirements.
 * @param password The password string to validate.
 * @returns An error message string if invalid, otherwise null.
 */
const validatePassword = (password: string): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one special character';
    return null;
};

/**
 * A page component that handles the password reset flow. It verifies the
 * access token from the URL and allows the user to set a new password.
 */
export default function ResetPasswordPage() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>('Verifying your request...');

    useEffect(() => {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');

        if (!accessToken) {
            setError('Invalid or expired password reset link.');
            setMessage(null);
        } else {
            setMessage('You can now reset your password.');
        }
    }, []);

    const handleResetPassword = async () => {
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) {
                throw updateError;
            }

            showAlert('Password updated successfully! You can now sign in.', 'success');
            router.push('/');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
            showAlert(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#101710] p-4">
            <div className="w-full max-w-md">
                <div className="bg-gradient-to-br from-[#104423] to-[#0a2f18] p-8 rounded-xl shadow-2xl border border-green-900/30">
                    <h1 className="font-['Space_Grotesk',_sans-serif] text-3xl font-bold text-green-400 mb-6 text-center">Reset Your Password</h1>

                    {message && !error && <p className="text-center text-green-300 mb-4">{message}</p>}
                    {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">{error}</div>}

                    {!error && (
                        <>
                            <input
                                type="password"
                                placeholder="Enter your new password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            />
                            <input
                                type="password"
                                placeholder="Confirm your new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full mb-6 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            />
                            <button
                                onClick={handleResetPassword}
                                disabled={loading || !password || !confirmPassword}
                                className="w-full p-3 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-lg"
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </>
                    )}

                    <button onClick={() => router.push('/')} className="mt-6 text-green-400 hover:text-green-300 underline w-full text-center cursor-pointer transition-colors">
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
