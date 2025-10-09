'use client';

import { useEffect, useState } from 'react';
import { useAlert } from '@/context/AlertContext';

/**
 * Shows transient alert notifications from the global alert context.
 * @returns An animated alert banner or null when no message is active.
 */
export default function Alert() {
    const { alert, hideAlert } = useAlert();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (alert) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(hideAlert, 300);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [alert, hideAlert]);

    if (!alert) return null;

    const baseStyle = 'fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white transition-all duration-300 ease-in-out z-50';
    const visibilityStyle = isVisible ? 'animate-slide-in' : 'animate-slide-out';

    let colorStyle = 'bg-green-600';
    if (alert.type === 'error') {
        colorStyle = 'bg-red-600';
    } else if (alert.type === 'warning') {
        colorStyle = 'bg-yellow-500 text-black';
    }

    return (
        <div className={`${baseStyle} ${colorStyle} ${visibilityStyle}`}>
            <p>{alert.message}</p>
        </div>
    );
}
