import { authClient } from './auth-client';

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

export async function submitEmailAuth(mode: 'signin' | 'signup' | 'reset', email: string, password: string, username: string, origin: string) {
    if (mode === 'reset') {
        const { error } = await authClient.requestPasswordReset({ email, redirectTo: `${origin}/reset-password` });
        if (error) throw new Error(error.message || 'Could not request a reset email.');
        return 'If an account exists for this email, a reset link will arrive shortly.';
    }
    if (mode === 'signup') {
        const passwordError = validatePassword(password);
        if (passwordError) throw new Error(passwordError);
        const name = username.trim();
        if (name.length < 3 || name.length > 15) throw new Error('Username must be 3–15 characters.');
        const { error } = await authClient.signUp.email({ email, password, name, callbackURL: origin });
        if (error) throw new Error(error.message || 'Could not create your account.');
        return 'Check your email to verify your account before signing in.';
    }
    const { error } = await authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message || 'Could not sign in.');
    return 'Signed in successfully!';
}
