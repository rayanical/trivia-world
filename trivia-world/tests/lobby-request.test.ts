import { afterEach, expect, spyOn, test } from 'bun:test';
import { socket } from '../src/lib/socket';
import { requestLobby } from '../src/lib/lobby-request';

const emit = spyOn(socket, 'emit').mockImplementation(() => socket);
afterEach(() => { emit.mockClear(); socket.removeAllListeners(); socket.connected = false; });
function deliver(event: string, payload: unknown) { for (const listener of socket.listeners(event)) listener.call(socket,payload); }

test('lobby success removes listeners and accepts only one result', async () => {
    socket.connected = true;
    const request = requestLobby('create-game', {name: 'Player'}, new AbortController().signal);
    deliver('game-created', 'ABCDE');
    expect(await request).toBe('ABCDE');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(socket.listeners('game-created')).toHaveLength(0);
    expect(socket.listeners('join-error')).toHaveLength(0);
});

test('a rejected join cleans up so another join can succeed', async () => {
    socket.connected = true;
    const first = requestLobby('join-game', {}, new AbortController().signal);
    deliver('join-error', 'Game not found');
    await expect(first).rejects.toThrow('Game not found');
    const second = requestLobby('join-game', {}, new AbortController().signal);
    deliver('join-success', {gameCode:'ABCDE'});
    expect(await second).toBe('ABCDE');
    expect(socket.listeners('join-success')).toHaveLength(0);
});

test('navigation cancels listeners and disconnected requests never queue an event', async () => {
    socket.connected = true;
    const controller = new AbortController();
    const pending = requestLobby('create-game', {}, controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
    expect(socket.listeners('game-created')).toHaveLength(1);
    const requestId = (emit.mock.calls[0][1] as {requestId: string}).requestId;
    deliver('game-created', {gameCode: 'OLD01', requestId});
    expect(emit.mock.calls.at(-1)?.[0]).toBe('leave-game');
    expect(socket.listeners('game-created')).toHaveLength(0);
    socket.connected = false;
    await expect(requestLobby('create-game', {}, new AbortController().signal)).rejects.toThrow('Connect');
    expect(emit).toHaveBeenCalledTimes(2);
});

test('a cancelled late reply cannot resolve a newer lobby request', async () => {
    socket.connected = true;
    const controller = new AbortController();
    const old = requestLobby('create-game', {}, controller.signal);
    const oldId = (emit.mock.calls[0][1] as { requestId: string }).requestId;
    controller.abort(); await expect(old).rejects.toThrow('cancelled');
    const current = requestLobby('create-game', {}, new AbortController().signal);
    const currentId = (emit.mock.calls[1][1] as { requestId: string }).requestId;
    deliver('game-created', { gameCode: 'OLD01', requestId: oldId });
    expect(socket.listeners('game-created')).toHaveLength(1);
    deliver('game-created', { gameCode: 'NEW01', requestId: currentId });
    expect(await current).toBe('NEW01');
});
