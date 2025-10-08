'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type AlertType = 'success' | 'error' | 'warning';
type AlertMessage = { message: string; type: AlertType };

type AlertContextType = {
    alert: AlertMessage | null;
    showAlert: (message: string, type?: AlertType) => void;
    hideAlert: () => void;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alert, setAlert] = useState<AlertMessage | null>(null);

    const showAlert = useCallback((message: string, type: AlertType = 'error') => {
        setAlert({ message, type });
    }, []);

    const hideAlert = useCallback(() => {
        setAlert(null);
    }, []);

    return <AlertContext.Provider value={{ alert, showAlert, hideAlert }}>{children}</AlertContext.Provider>;
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
}
