import { socket } from './socket';

// One request owns its listeners; errors, disconnects and navigation all clean up.
export function requestLobby(event: 'create-game' | 'join-game', payload: object, signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
        if (signal.aborted || !socket.connected) return reject(new Error('Connect to the game server and try again.'));
        const successEvent = event === 'create-game' ? 'game-created' : 'join-success';
        const cleanup = () => {
            clearTimeout(timer);
            socket.off(successEvent, onSuccess);
            socket.off('join-error', onError);
            socket.off('disconnect', onDisconnect);
            signal.removeEventListener('abort', onAbort);
        };
        const onSuccess = (result: string | { gameCode: string }) => { cleanup(); resolve(typeof result === 'string' ? result : result.gameCode); };
        const onError = (message: string) => { cleanup(); reject(new Error(message)); };
        const onDisconnect = () => onError('Connection lost. Please try again.');
        const onAbort = () => onError('Request cancelled.');
        const timer = setTimeout(() => onError('The game server did not respond. Please try again.'), 10_000);
        socket.once(successEvent, onSuccess);
        socket.once('join-error', onError);
        socket.once('disconnect', onDisconnect);
        signal.addEventListener('abort', onAbort, { once: true });
        socket.emit(event, payload);
    });
}
