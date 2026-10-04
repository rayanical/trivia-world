'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import { emptySaveState, getAnswerOutbox } from '@/lib/answer-outbox';
const subscribe = (listener: () => void) => getAnswerOutbox().subscribe(listener);
const serverSnapshot = () => emptySaveState;
export function useSoloSaveState() {
    const { user } = useAuth();
    const owner = user?.id || 'guest';
    const snapshot = useCallback(() => getAnswerOutbox().snapshot(owner), [owner]);
    return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
