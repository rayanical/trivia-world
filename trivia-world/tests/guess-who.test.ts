import { expect, test } from 'bun:test';
import { applyAction, createRoom, viewRoom, type RoomPlayer } from '../src/server/guess-who/engine';
import type { GuessCard } from '../src/lib/guess-who/types';
const cards: GuessCard[] = ['animals', 'foods', 'celebrities'].flatMap(category => Array.from({ length: 45 }, (_, i) => ({ id: `${category}-${i}`, name: `${category} ${i}`, image: `/test/${i}.svg`, category: category === 'animals' ? 'animals' : category === 'foods' ? 'foods' : 'celebrities' })));
const player = (id: string): RoomPlayer => ({ id, key: `guest:${id}`, socketId: id, name: id, connected: true, ready: true, secretId: null, skipNext: false });
function setup(chat = true) {
    const room = createRoom('ABCDE', player('Alice')); room.players.push(player('Bob'));
    applyAction(room, 'Alice', { type: 'settings', category: 'animals', chat }, cards);
    applyAction(room, 'Alice', { type: 'start' }, cards);
    return room;
}
function playing(chat = true, sameSecret = false) {
    const room = setup(chat);
    applyAction(room, 'Alice', { type: 'select', cardId: room.board[0].id }, cards);
    applyAction(room, 'Bob', { type: 'select', cardId: room.board[sameSecret ? 0 : 1].id }, cards);
    return room;
}
test('a round uses 20 distinct shared cards while each secret is private', () => {
    const room = setup(); const aliceSecret = room.board[0].id; const bobSecret = room.board[1].id;
    expect(room.board).toHaveLength(20); expect(new Set(room.board.map(card => card.id)).size).toBe(20);
    applyAction(room, 'Alice', { type: 'select', cardId: aliceSecret }, cards);
    expect(viewRoom(room, 'Bob').secretId).toBeNull(); expect(viewRoom(room, 'Bob').revealedSecrets).toEqual([]);
    expect(viewRoom(room, 'Bob').players[0].picked).toBe(true);
    expect(JSON.stringify(viewRoom(room, 'Bob').players)).not.toContain('secretId');
    applyAction(room, 'Bob', { type: 'select', cardId: bobSecret }, cards);
    expect(viewRoom(room, 'Alice').secretId).toBe(aliceSecret);
    expect(viewRoom(room, 'Bob').secretId).toBe(bobSecret);
    expect(room.phase).toBe('playing'); expect(room.turnId).toBe('Alice');
    expect(() => viewRoom(room, 'outsider')).toThrow();
});
test('manual chat enforces question ownership and passes the turn after an answer', () => {
    const room = playing();
    expect(() => applyAction(room, 'Bob', { type: 'ask', text: 'Is it furry?' }, cards)).toThrow();
    applyAction(room, 'Alice', { type: 'ask', text: 'Is it furry?' }, cards);
    expect(() => applyAction(room, 'Alice', { type: 'answer', answer: 'Yes' }, cards)).toThrow();
    expect(() => applyAction(room, 'Alice', { type: 'end-turn' }, cards)).toThrow();
    applyAction(room, 'Bob', { type: 'answer', answer: 'Yes' }, cards);
    expect(room.pendingQuestion).toBeNull(); expect(room.turnId).toBe('Bob');
    expect(room.messages.filter(message => message.kind === 'answer')[0].text).toBe('Yes');
});
test('a wrong guess gives the opponent two consecutive turns, then normal play resumes', () => {
    const room = playing(false);
    applyAction(room, 'Alice', { type: 'guess', cardId: room.board[2].id }, cards);
    expect(room.turnId).toBe('Bob'); expect(room.players[0].skipNext).toBe(true);
    expect(() => applyAction(room, 'Alice', { type: 'end-turn' }, cards)).toThrow();
    applyAction(room, 'Bob', { type: 'end-turn' }, cards);
    expect(room.turnId).toBe('Bob'); expect(room.players[0].skipNext).toBe(false);
    applyAction(room, 'Bob', { type: 'end-turn' }, cards);
    expect(room.turnId).toBe('Alice');
});
test('successive wrong guesses consume both penalties without getting stuck', () => {
    const room = playing(false);
    applyAction(room, 'Alice', { type: 'guess', cardId: room.board[2].id }, cards);
    applyAction(room, 'Bob', { type: 'guess', cardId: room.board[2].id }, cards);
    expect(room.turnId).toBe('Alice'); expect(room.players.every(p => !p.skipNext)).toBe(true);
});
test('correct guesses reveal secrets, while rematches reset and avoid the previous board', () => {
    const room = playing(true, true); const previous = new Set(room.board.map(card => card.id));
    expect(room.players[0].secretId).toBe(room.players[1].secretId);
    applyAction(room, 'Alice', { type: 'guess', cardId: room.board[0].id }, cards);
    expect(room.phase).toBe('finished'); expect(room.winnerId).toBe('Alice');
    expect(viewRoom(room, 'Bob').revealedSecrets).toHaveLength(2);
    expect(() => applyAction(room, 'Bob', { type: 'rematch' }, cards)).toThrow();
    applyAction(room, 'Alice', { type: 'rematch' }, cards);
    expect(room.board.every(card => !previous.has(card.id))).toBe(true);
    expect(room.settings.chat).toBe(true); expect(room.messages).toHaveLength(1);
    expect(room.players.every(p => !p.secretId && !p.skipNext)).toBe(true);
    applyAction(room, 'Alice', { type: 'select', cardId: room.board[0].id }, cards);
    applyAction(room, 'Bob', { type: 'select', cardId: room.board[1].id }, cards);
    expect(room.turnId).toBe('Bob');
});
test('host settings, locked secrets, invalid cards, disconnects and chat-off are guarded', () => {
    const room = setup(false);
    expect(() => applyAction(room, 'Bob', { type: 'settings', category: 'foods', chat: true }, cards)).toThrow();
    expect(() => applyAction(room, 'Alice', { type: 'select', cardId: 'missing' }, cards)).toThrow();
    applyAction(room, 'Alice', { type: 'select', cardId: room.board[0].id }, cards);
    expect(() => applyAction(room, 'Alice', { type: 'select', cardId: room.board[1].id }, cards)).toThrow();
    applyAction(room, 'Bob', { type: 'select', cardId: room.board[1].id }, cards);
    expect(() => applyAction(room, 'Alice', { type: 'ask', text: 'Is it furry?' }, cards)).toThrow();
    room.players[1].connected = false;
    expect(() => applyAction(room, 'Alice', { type: 'end-turn' }, cards)).toThrow();
    room.players[1].connected = true; applyAction(room, 'Alice', { type: 'end-turn' }, cards);
    expect(room.turnId).toBe('Bob');
});
test('round sampling varies and all random categories are supported', () => {
    const first = setup(); const second = setup();
    expect(first.board.map(card => card.id)).not.toEqual(second.board.map(card => card.id));
    for (const random of [() => 0, () => .4, () => .9]) {
        const room = createRoom('ABCDE', player('Alice')); room.players.push(player('Bob'));
        applyAction(room, 'Alice', { type: 'start' }, cards, random);
        expect(room.board).toHaveLength(20); expect(room.board.every(card => card.category === room.category)).toBe(true);
    }
});

test('starter catalogue has distinct named cards, local artwork and recorded licenses', async () => {
    const { default: catalogue } = await import('../src/lib/guess-who/catalogue.json');
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    expect(new Set(catalogue.map(card => card.id)).size).toBe(catalogue.length);
    for (const category of ['animals', 'foods', 'celebrities']) expect(catalogue.filter(card => card.category === category).length).toBeGreaterThanOrEqual(40);
    expect(catalogue.every(card => card.name && card.author && card.license && card.source.startsWith('https://'))).toBe(true);
    expect(catalogue.every(card => existsSync(join(import.meta.dir, '../public', card.image)))).toBe(true);
});

test('ready status is player-owned, survives snapshots and resets for a new round', () => {
    const room = createRoom('ABCDE', player('Alice')); room.players.push(player('Bob'));
    applyAction(room, 'Bob', { type: 'ready', ready: false }, cards);
    expect(viewRoom(room, 'Alice').players.map(p => p.ready)).toEqual([true, false]);
    applyAction(room, 'Bob', { type: 'ready', ready: true }, cards);
    expect(viewRoom(room, 'Bob').players.map(p => p.ready)).toEqual([true, true]);
    applyAction(room, 'Alice', { type: 'start' }, cards);
    expect(room.players.every(p => !p.ready)).toBe(true);
    expect(() => applyAction(room, 'Alice', { type: 'ready', ready: true }, cards)).toThrow();
    applyAction(room, 'Alice', { type: 'select', cardId: room.board[0].id }, cards);
    applyAction(room, 'Bob', { type: 'select', cardId: room.board[0].id }, cards);
    applyAction(room, 'Alice', { type: 'guess', cardId: room.board[0].id }, cards);
    applyAction(room, 'Bob', { type: 'ready', ready: true }, cards);
    expect(viewRoom(room, 'Alice').players[1].ready).toBe(true);
    applyAction(room, 'Alice', { type: 'rematch' }, cards);
    expect(room.players.every(p => !p.ready)).toBe(true);
});
