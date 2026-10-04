'use client';
import { useEffect, useState, useRef } from 'react';
import { submitEmailAuth } from '@/lib/email-auth';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useAlert } from '@/context/AlertContext';
import { useAuth } from '@/context/AuthContext';
export function useAuthForm(isOpen: boolean, onClose: () => void) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
    const isSignup = mode === 'signup';
    const isResetting = mode === 'reset';
    const submitting = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { showAlert } = useAlert();
    const { requireServer } = useAuth();
    const [googleEnabled, setGoogleEnabled] = useState(false);


    useEffect(() => {
        if (!isOpen) return;
        const controller = new AbortController();
        api<{ googleEnabled: boolean }>('/config', { signal: controller.signal })
            .then(config => { if (!controller.signal.aborted) setGoogleEnabled(config.googleEnabled); })
            .catch(() => { if (!controller.signal.aborted) setGoogleEnabled(false); });
        return () => controller.abort();
    }, [isOpen]);

    /**
     * Handles email-based sign in or sign up flows, including profile provisioning.
     */
    const handleAuth = async () => {
        if (submitting.current) return;
        if (!requireServer()) { setError('The server is connecting. Please try again in a moment.'); return; }
        submitting.current = true;
        setLoading(true);
        setError(null);

        try {
            const message = await submitEmailAuth(mode, email, password, username, window.location.origin);
            showAlert(message, 'success');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    };

    /**
     * Initiates an OAuth sign-in flow with the supplied provider using Better Auth.
     * @param provider - External identity provider identifier (currently Google).
     */
    const handleOAuthSignIn = async (provider: 'google') => {
        if (submitting.current) return;
        if (!requireServer()) { setError('The server is connecting. Please try again in a moment.'); return; }
        submitting.current = true;
        setLoading(true);
        setError(null);
        try {
            const { error } = await authClient.signIn.social({ provider, callbackURL: window.location.href });
            if (error) throw new Error(error.message || 'Failed to sign in with Google');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    };

    return { email, setEmail, password, setPassword, username, setUsername, mode, setMode, isSignup, isResetting, error, setError, loading, googleEnabled, handleAuth, handleOAuthSignIn };
}
