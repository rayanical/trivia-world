'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { GuessAction, GuessState } from '@/lib/guess-who/types';
import { useGuessConnection } from './GuessConnection';
const subscribe = () => () => {};
const rememberedRoom = () => { try { return sessionStorage.getItem('guessJoined') || ''; } catch { return ''; } };
const serverRoom = () => null;
export function useGuessRoom(create: boolean, code?: string) {
    const connection = useGuessConnection(); const { socket, connected, send } = connection; const { profile } = useAuth();
    const [state, setState] = useState<GuessState | null>(null);
    const stateRef = useRef<GuessState | null>(null); const pendingRef = useRef(false);
    const [pending, setPending] = useState(false); const [error, setError] = useState('');
    const remembered = useSyncExternalStore(subscribe, rememberedRoom, serverRoom);
    const joined = create || Boolean(state) || (Boolean(code) && remembered === code);
    const checkingMembership = !create && remembered === null;
    const name = useCallback(() => { try { return profile?.username || sessionStorage.getItem('playerName') || 'Guest'; } catch { return profile?.username || 'Guest'; } }, [profile?.username]);
    useEffect(() => {
        if (!socket) return;
        let disposed = false;
        const receive = (next: GuessState) => {
            if (disposed || (code && next.code !== code) || (stateRef.current && next.version < stateRef.current.version)) return;
            stateRef.current = next; setState(next);
            try { sessionStorage.setItem('guessJoined', next.code); } catch {}
            if (create && !code) window.history.replaceState(window.history.state, '', `/guess-who/play?room=${next.code}`);
        };
        socket.on('guess-state', receive);
        let previouslyJoined = false;
        try { previouslyJoined = sessionStorage.getItem('guessJoined') === code; } catch {}
        if (connected && (create || stateRef.current || previouslyJoined)) {
            const action: GuessAction = stateRef.current || previouslyJoined || (create && code) ? { type: 'state' } : { type: 'create', name: name(), fresh: true };
            void send(action, stateRef.current?.code || code).then(reply => {
                if (disposed) return;
                if (reply.state) receive(reply.state);
                setError(reply.error || '');
            }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Could not connect to this room.'); });
        }
        return () => { disposed = true; socket.off('guess-state', receive); };
    }, [socket, connected, send, create, code, name]);
    const act = async (action: GuessAction) => {
        if (pendingRef.current) return false;
        pendingRef.current = true; setPending(true); setError('');
        try {
            const reply = await connection.send(action, stateRef.current?.code || code, stateRef.current?.version);
            if (reply.state && (!stateRef.current || reply.state.version >= stateRef.current.version)) { stateRef.current = reply.state; setState(reply.state); try { sessionStorage.setItem('guessJoined', reply.state.code); } catch {} }
            if (reply.error) { setError(reply.error); return false; }
            if (action.type === 'leave') { try { sessionStorage.removeItem('guessJoined'); } catch {} }
            return true;
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not complete that action.');
            // Resolve an uncertain acknowledgement before permitting another turn command.
            if (stateRef.current && connection.connected) {
                try { const reply = await connection.send({ type: 'state' }, stateRef.current.code); if (reply.state && reply.state.version >= stateRef.current.version) { stateRef.current = reply.state; setState(reply.state); } } catch {}
            }
            return false;
        } finally { pendingRef.current = false; setPending(false); }
    };
    return { state, joined, checkingMembership, pending, error, act, name, ...connection };
}
