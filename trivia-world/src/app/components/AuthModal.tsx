'use client';
import { useEffect, useRef } from 'react';
import AuthForm from './AuthForm';
type AuthModalProps = { isOpen: boolean; onClose: () => void };
export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (!isOpen) return;
        const element = dialog.current;
        const previousFocus = document.activeElement;
        element?.showModal();
        return () => {
            element?.close();
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        };
    }, [isOpen]);
    if (!isOpen) return null;
    return <dialog ref={dialog} aria-labelledby="auth-title" onCancel={onClose} className="fixed inset-0 m-0 w-full h-full max-w-none max-h-none flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <AuthForm isOpen={isOpen} onClose={onClose} />
    </dialog>;
}
