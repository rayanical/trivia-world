'use client';

import { useEffect, useState } from 'react';
import { useAlert, useAlertMessage } from '@/context/AlertContext';

/**
 * Shows transient alert notifications from the global alert context.
 * @returns An animated alert banner or null when no message is active.
 */
export default function Alert() {
    const { hideAlert } = useAlert();
    const alert = useAlertMessage();
    const [exitingAlert, setExitingAlert] = useState<typeof alert>(null);
    const isVisible = alert !== exitingAlert;

    useEffect(() => {
        if (alert) {
            const exitTimer = setTimeout(() => setExitingAlert(alert), 3000);
            const hideTimer = setTimeout(hideAlert, 3300);
            return () => { clearTimeout(exitTimer); clearTimeout(hideTimer); };
        }
    }, [alert, hideAlert]);

    if (!alert) return null;

    const baseStyle = 'fixed top-5 right-5 max-w-[calc(100vw-2.5rem)] p-4 rounded-lg shadow-lg text-white z-50';
    const visibilityStyle = isVisible ? 'animate-slide-in' : 'animate-slide-out';

    let colorStyle = 'bg-green-600';
    if (alert.type === 'error') {
        colorStyle = 'bg-red-600';
    } else if (alert.type === 'warning') {
        colorStyle = 'bg-yellow-500 text-black';
    }

    return (
        <div role="status" aria-live="polite" className={`${baseStyle} ${colorStyle} ${visibilityStyle}`}>
            <p>{alert.message}</p>
        </div>
    );
}
