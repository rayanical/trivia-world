'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { authClient } from '@/lib/auth-client';
import { guestId } from '@/lib/socket';
import type { GuessAction, GuessReply, GuessRequest } from '@/lib/guess-who/types';
type Connection = { socket: Socket | null; connected: boolean; connectionError: string; send: (action: GuessAction, code?: string, version?: number) => Promise<GuessReply> };
const Context = createContext<Connection | null>(null);
export default function GuessConnection({ children }: { children: ReactNode }) {
    const { data: session, isPending, error } = authClient.useSession();
    const token = session?.session.token;
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    useEffect(() => {
        if (isPending || error) return;
        const connection = io(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'}/guess`, { autoConnect: false, auth: { token, guestId: guestId() } });
        socketRef.current = connection; setSocket(connection);
        const onConnect = () => { setConnected(true); setConnectionError(''); };
        const onDisconnect = () => setConnected(false);
        const onError = () => { setConnected(false); setConnectionError('The game server is unavailable. Reconnecting in the background.'); };
        const onReplaced = (message: string) => { setConnectionError(message); connection.disconnect(); };
        connection.on('connect', onConnect); connection.on('disconnect', onDisconnect); connection.on('connect_error', onError); connection.on('guess-replaced', onReplaced);
        connection.connect();
        return () => { connection.off('connect', onConnect); connection.off('disconnect', onDisconnect); connection.off('connect_error', onError); connection.off('guess-replaced', onReplaced); connection.disconnect(); socketRef.current = null; setSocket(null); setConnected(false); };
    }, [isPending, error, token]);
    const send = useCallback(async (action: GuessAction, code?: string, version?: number): Promise<GuessReply> => {
        const connection = socketRef.current;
        if (!connection?.connected) throw new Error('The server is waking up or reconnecting. Please try again in a moment.');
        const request: GuessRequest = { requestId: crypto.randomUUID(), action, code, version };
        try { return await connection.timeout(10_000).emitWithAck('guess-action', request); }
        catch { throw new Error('The server did not confirm that action. Reconnect and check the game before trying again.'); }
    }, []);
    const value = useMemo(() => ({ socket, connected, connectionError, send }), [socket, connected, connectionError, send]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useGuessConnection() {
    const connection = useContext(Context);
    if (!connection) throw new Error('Guess Who needs its connection provider.');
    return connection;
}
