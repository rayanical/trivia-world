'use client';

import { useEffect, useState } from 'react';
import PasswordValidator from './PasswordValidator';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useAlert } from '@/context/AlertContext';

type AuthModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

/**
 * Validates password complexity requirements for sign-up flows.
 * @param password - Raw password input supplied by the user.
 * @returns Descriptive error string when invalid, otherwise null.
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
 * Presents a modal for signing in or creating an account via Better Auth.
 * @param props - Control flags and callbacks for the modal lifecycle.
 * @returns Authentication modal dialog or null when closed.
 */
export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isSignup, setIsSignup] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { showAlert } = useAlert();
    const [googleEnabled, setGoogleEnabled] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (isOpen) api<{ googleEnabled: boolean }>('/config').then((config) => setGoogleEnabled(config.googleEnabled)).catch(() => setGoogleEnabled(false));
    }, [isOpen]);

    /**
     * Handles email-based sign in or sign up flows, including profile provisioning.
     */
    const handleAuth = async () => {
        setLoading(true);
        setError(null);

        try {
            if (isResetting) {
                const { error } = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
                if (error) throw new Error(error.message || 'Could not request a reset email.');
                showAlert('If an account exists for this email, a reset link will arrive shortly.', 'success');
                onClose();
            } else if (isSignup) {
                const passwordError = validatePassword(password);
                if (passwordError) throw new Error(passwordError);
                const name = username.trim();
                if (name.length < 3 || name.length > 15) throw new Error('Username must be 3–15 characters.');
                const { error } = await authClient.signUp.email({ email, password, name, callbackURL: window.location.origin });
                if (error) throw new Error(error.message || 'Could not create your account.');
                showAlert('Check your email to verify your account before signing in.', 'success');
                onClose();
            } else {
                const { error } = await authClient.signIn.email({ email, password });
                if (error) throw new Error(error.message || 'Could not sign in.');
                showAlert('Signed in successfully!', 'success');
                onClose();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Initiates an OAuth sign-in flow with the supplied provider using Better Auth.
     * @param provider - External identity provider identifier (currently Google).
     */
    const handleOAuthSignIn = async (provider: 'google') => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await authClient.signIn.social({ provider, callbackURL: window.location.href });
            if (error) throw new Error(error.message || 'Failed to sign in with Google');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
            <div className="bg-gradient-to-br from-[#104423] to-[#0a2f18] p-8 rounded-xl shadow-2xl border border-green-900/30 w-full max-w-md">
                <h2 className="text-3xl font-bold text-green-400 mb-6 text-center">{isResetting ? 'Reset Password' : isSignup ? 'Sign Up' : 'Sign In'}</h2>
                {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">{error}</div>}
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                />
                {!isResetting && <input
                    type="password"
                    placeholder={isSignup ? 'Password (min 8 chars, 1 upper, 1 number, 1 special)' : 'Password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                />}
                {!isResetting && isSignup && <PasswordValidator password={password} />}

                {!isResetting && isSignup && (
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
                        disabled={loading || !email || (!isResetting && (!password || (isSignup && username.trim().length < 3)))}
                        className="flex-1 p-3 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-lg"
                    >
                        {loading ? 'Loading...' : isResetting ? 'Send Reset Email' : isSignup ? 'Sign Up' : 'Sign In'}
                    </button>
                    <button onClick={onClose} className="flex-1 p-3 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer transition-colors shadow-lg">
                        Cancel
                    </button>
                </div>
                <button onClick={() => { setIsResetting(false); setIsSignup(!isSignup); setError(null); }} className="mt-4 text-green-400 hover:text-green-300 underline w-full text-center cursor-pointer transition-colors">
                    {isSignup ? 'Switch to Sign In' : 'Switch to Sign Up'}
                </button>

                <button onClick={() => { setIsResetting(!isResetting); setError(null); }} className="mt-3 text-green-400 underline w-full text-center cursor-pointer">
                    {isResetting ? 'Back to sign in' : 'Forgot password?'}
                </button>
                {googleEnabled && !isResetting && <>
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-500" />
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-2 bg-[#0a2f18] text-sm text-gray-400">Or continue with</span>
                    </div>
                </div>
                <div>
                    <button
                        onClick={() => handleOAuthSignIn('google')}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 p-3 rounded-lg bg-white text-gray-800 font-bold hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12.5C5,8.75 8.36,5.73 12.19,5.73C14.03,5.73 15.69,6.31 16.95,7.45L19.05,5.35C17.11,3.45 14.8,2.5 12.19,2.5C6.92,2.5 3,6.58 3,12.5C3,18.42 6.92,22.5 12.19,22.5C17.6,22.5 21.7,18.34 21.7,12.72C21.7,12.08 21.54,11.58 21.35,11.1Z"
                            />
                        </svg>
                        Sign in with Google
                    </button>
                </div>
                </>}
            </div>
        </div>
    );
}
