import { socket } from './socket';

type LobbyResult = string | { gameCode: string; requestId?: string };
// Correlate replies so a cancelled request cannot satisfy the next room request.
export function requestLobby(event: 'create-game' | 'join-game', payload: object, signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
        if (signal.aborted || !socket.connected) return reject(new Error('Connect to the game server and try again.'));
        const requestId = crypto.randomUUID();
        const successEvent = event === 'create-game' ? 'game-created' : 'join-success';
        const matches = (result: LobbyResult) => typeof result === 'string' || !result.requestId || result.requestId === requestId;
        const codeOf = (result: LobbyResult) => typeof result === 'string' ? result : result.gameCode;
        const cleanup = () => {
            clearTimeout(timer);
            socket.off(successEvent, onSuccess);
            socket.off('join-error', onError);
            socket.off('disconnect', onDisconnect);
            signal.removeEventListener('abort', onAbort);
        };
        const onSuccess = (result: LobbyResult) => { if (matches(result)) { cleanup(); resolve(codeOf(result)); } };
        const onError = (result: string | { message: string; requestId?: string }) => {
            if (typeof result !== 'string' && result.requestId && result.requestId !== requestId) return;
            cleanup(); reject(new Error(typeof result === 'string' ? result : result.message));
        };
        const onDisconnect = () => onError('Connection lost. Please try again.');
        const onAbort = () => {
            cleanup();
            // The server may already be creating/joining the room. Leave its late result.
            const release = (result: LobbyResult) => {
                if (!matches(result)) return;
                clearTimeout(lateTimer); socket.off(successEvent, release);
                if (socket.connected) socket.emit('leave-game', { gameCode: codeOf(result) });
            };
            const lateTimer = setTimeout(() => socket.off(successEvent, release), 10_000);
            socket.on(successEvent, release);
            reject(new Error('Request cancelled.'));
        };
        const timer = setTimeout(() => onError('The game server did not respond. Please try again.'), 10_000);
        socket.on(successEvent, onSuccess);
        socket.on('join-error', onError);
        socket.once('disconnect', onDisconnect);
        signal.addEventListener('abort', onAbort, { once: true });
        socket.emit(event, { ...payload, requestId });
    });
}
