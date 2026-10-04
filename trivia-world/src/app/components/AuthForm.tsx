'use client';
import AuthFields from './AuthFields';
import { useAuthForm } from '@/hooks/useAuthForm';
const labels = { signin: { title: 'Sign In', submit: 'Sign In' }, signup: { title: 'Sign Up', submit: 'Sign Up' }, reset: { title: 'Reset Password', submit: 'Send Reset Email' } };
export default function AuthForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { email, setEmail, password, setPassword, username, setUsername, mode, setMode, isSignup, isResetting, error, setError, loading, googleEnabled, handleAuth, handleOAuthSignIn } = useAuthForm(isOpen, onClose);
    const title = labels[mode].title;
    const submitLabel = loading ? 'Loading...' : labels[mode].submit;
    const credentialsMissing = !isResetting && (!password || (isSignup && username.trim().length < 3));
    const disabled = loading || !email || credentialsMissing;
    return (
            <form action={handleAuth} className="bg-gradient-to-br from-[#104423] to-[#0a2f18] p-8 rounded-xl shadow-2xl border border-green-900/30 w-full max-w-md max-h-full overflow-y-auto">
                <h2 id="auth-title" className="text-3xl font-bold text-green-400 mb-6 text-center">{title}</h2>
                {error && <div role="alert" className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">{error}</div>}
                <AuthFields email={email} setEmail={setEmail} password={password} setPassword={setPassword} username={username} setUsername={setUsername} isSignup={isSignup} isResetting={isResetting} />
                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={disabled}
                        className="flex-1 p-3 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-lg"
                    >
                        {submitLabel}
                    </button>
                    <button type="button" onClick={onClose} className="flex-1 p-3 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer transition-colors shadow-lg">
                        Cancel
                    </button>
                </div>
                <button type="button" onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); }} className="mt-4 text-green-400 hover:text-green-300 underline w-full text-center cursor-pointer transition-colors">
                    {isSignup ? 'Switch to Sign In' : 'Switch to Sign Up'}
                </button>

                <button type="button" onClick={() => { setMode(isResetting ? 'signin' : 'reset'); setError(null); }} className="mt-3 text-green-400 underline w-full text-center cursor-pointer">
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
                        type="button" onClick={() => handleOAuthSignIn('google')}
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
            </form>
);
}
