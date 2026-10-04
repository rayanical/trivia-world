import { randomUUID } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import { guessCategories, type GuessAction, type GuessCard, type GuessReply, type GuessRequest } from '../../lib/guess-who/types';
import catalogue from '../../lib/guess-who/catalogue.json';
import { applyAction, createRoom, viewRoom, type GuessRoom, type RoomPlayer } from './engine';
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid game request.');
    return value as Record<string, unknown>;
}
function text(value: unknown, limit: number) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) throw new Error('Invalid game input.');
    return value.trim();
}
function parseRequest(value: unknown): GuessRequest {
    const payload = record(value); const action = record(payload.action);
    const requestId = text(payload.requestId, 64);
    const code = payload.code === undefined ? undefined : text(payload.code, 5).toUpperCase();
    if (code && !/^[A-Z0-9]{5}$/.test(code)) throw new Error('Enter a five-character game code.');
    const version = payload.version;
    if (version !== undefined && (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0)) throw new Error('Invalid game version.');
    let parsed: GuessAction;
    switch (action.type) {
        case 'create': parsed = { type: 'create', name: text(action.name, 100).slice(0, 15), fresh: action.fresh === true }; break;
        case 'join': parsed = { type: 'join', name: text(action.name, 100).slice(0, 15) }; break;
        case 'ready':
            if (typeof action.ready !== 'boolean') throw new Error('Choose a valid ready status.');
            parsed = { type: 'ready', ready: action.ready }; break;
        case 'settings': {
            const category = guessCategories.find(c => c.id === action.category)?.id;
            if (!category || typeof action.chat !== 'boolean') throw new Error('Choose a valid category and chat setting.');
            parsed = { type: 'settings', category, chat: action.chat }; break;
        }
        case 'select': case 'guess': parsed = { type: action.type, cardId: text(action.cardId, 100) }; break;
        case 'ask': parsed = { type: 'ask', text: text(action.text, 240) }; break;
        case 'answer':
            if (action.answer !== 'Yes' && action.answer !== 'No' && action.answer !== 'Not sure') throw new Error('Choose Yes, No or Not sure.');
            parsed = { type: 'answer', answer: action.answer }; break;
        case 'state': case 'leave': case 'start': case 'rematch': case 'return-lobby': case 'end-turn': parsed = { type: action.type }; break;
        default: throw new Error('Unknown game action.');
    }
    return { requestId, code, version: typeof version === 'number' ? version : undefined, action: parsed };
}
const cards: GuessCard[] = catalogue.map(c => ({ id: c.id, name: c.name, image: c.image, category: c.category as GuessCard['category'] }));
export function attachGuessWho(namespace: Namespace) {
    const rooms = new Map<string, GuessRoom>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const publish = (room: GuessRoom) => {
        for (const player of room.players) if (player.connected) namespace.to(player.socketId).emit('guess-state', viewRoom(room, player.id));
    };
    const forget = (room: GuessRoom, player: RoomPlayer) => {
        clearTimeout(timers.get(player.id)); timers.delete(player.id);
        room.players = room.players.filter(p => p !== player);
        if (!room.players.length) { rooms.delete(room.code); return; }
        if (room.hostId === player.id) room.hostId = room.players[0].id;
        if (room.phase !== 'lobby') {
            room.phase = 'abandoned'; room.turnId = null; room.pendingQuestion = null;
        }
        room.version++; publish(room);
    };
    const restore = (room: GuessRoom, socket: Socket) => {
        const player = room.players.find(p => p.key === socket.data.key);
        if (!player) return;
        clearTimeout(timers.get(player.id)); timers.delete(player.id);
        const old = namespace.sockets.get(player.socketId);
        if (old && old.id !== socket.id) {
            old.emit('guess-replaced', 'This player continued in another tab.'); old.leave(room.code); old.disconnect();
        }
        const changed = !player.connected || player.socketId !== socket.id;
        player.connected = true; player.socketId = socket.id; socket.join(room.code);
        if (changed) { room.version++; publish(room); }
        return player;
    };
    namespace.on('connection', socket => {
        let events = 0; let windowStart = Date.now();
        const seen = new Map<string, GuessReply>();
        socket.on('guess-action', (input: unknown, ack: unknown) => {
            if (typeof ack !== 'function') return;
            if (Date.now() - windowStart > 60_000) { events = 0; windowStart = Date.now(); }
            if (++events > 180) return ack({ error: 'Too many requests. Please slow down.' });
            let room: GuessRoom | undefined; let player: RoomPlayer | undefined;
            try {
                const request = parseRequest(input);
                // Idempotent commands: a duplicate click or retransmission cannot consume a second turn.
                const previous = seen.get(request.requestId);
                if (previous) return ack(previous);
                room = request.code ? rooms.get(request.code) : undefined;
                if (request.action.type === 'create') {
                    room = [...rooms.values()].find(r => r.players.some(p => p.key === socket.data.key));
                    if (room && request.action.fresh) {
                        const previousPlayer = room.players.find(p => p.key === socket.data.key);
                        if (previousPlayer) { socket.leave(room.code); forget(room, previousPlayer); }
                        room = undefined;
                    }
                    if (!room) {
                        if (rooms.size >= 1000) throw new Error('Too many active rooms. Please try again shortly.');
                        let code: string;
                        do { code = randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase(); } while (rooms.has(code));
                        player = { id: randomUUID(), key: socket.data.key, socketId: socket.id, name: (socket.data.user?.name || request.action.name).slice(0, 15), connected: true, ready: true, secretId: null, skipNext: false };
                        room = createRoom(code, player); rooms.set(code, room); socket.join(code);
                    } else player = restore(room, socket);
                } else {
                    if (!room) throw new Error('This room has ended or does not exist. Create a new game.');
                    if (request.action.type === 'join') {
                        player = restore(room, socket);
                        if (!player) {
                            if (room.players.length >= 2 || room.phase !== 'lobby') throw new Error('This room is full or the round has already started.');
                            // Each identity can belong to only one Guess Who room at a time.
                            if ([...rooms.values()].some(r => r.players.some(p => p.key === socket.data.key))) throw new Error('Leave your other Guess Who room first.');
                            player = { id: randomUUID(), key: socket.data.key, socketId: socket.id, name: (socket.data.user?.name || request.action.name).slice(0, 15), connected: true, ready: false, secretId: null, skipNext: false };
                            room.players.push(player); room.version++; socket.join(room.code);
                        }
                    } else {
                        player = request.action.type === 'state' ? restore(room, socket) : room.players.find(p => p.key === socket.data.key && p.socketId === socket.id && p.connected);
                        if (!player) throw new Error('Join this room before continuing.');
                        if (request.action.type === 'leave') {
                            socket.leave(room.code); forget(room, player); const reply = {}; seen.set(request.requestId, reply); return ack(reply);
                        }
                        if (request.action.type !== 'state') {
                            if (request.version !== room.version) throw new Error('The game changed. Please try your action again.');
                            applyAction(room, player.id, request.action, cards);
                        }
                    }
                }
                if (!room || !player) throw new Error('Could not join this game.');
                const reply = { state: viewRoom(room, player.id) };
                seen.set(request.requestId, reply); if (seen.size > 128) seen.delete(seen.keys().next().value!);
                publish(room); ack(reply);
            } catch (error) {
                ack({ error: error instanceof Error ? error.message : 'Could not complete that action.', ...(room && player ? { state: viewRoom(room, player.id) } : {}) });
            }
        });
        socket.on('disconnect', () => {
            for (const room of rooms.values()) {
                const player = room.players.find(p => p.socketId === socket.id && p.connected);
                if (!player) continue;
                player.connected = false; room.version++; publish(room);
                timers.set(player.id, setTimeout(() => forget(room, player), 30_000));
            }
        });
    });
    return () => { for (const timer of timers.values()) clearTimeout(timer); timers.clear(); rooms.clear(); };
}
