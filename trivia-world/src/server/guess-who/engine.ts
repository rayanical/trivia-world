import type { GuessAction, GuessCard, GuessMessage, GuessSettings, GuessState } from '../../lib/guess-who/types';
export type RoomPlayer = { id: string; key: string; socketId: string; name: string; connected: boolean; secretId: string | null; skipNext: boolean };
export type GuessRoom = {
    code: string; version: number; round: number; phase: GuessState['phase']; hostId: string; players: RoomPlayer[];
    settings: GuessSettings; category: GuessState['category']; board: GuessCard[]; turnId: string | null;
    winnerId: string | null; pendingQuestion: GuessState['pendingQuestion']; messages: GuessMessage[]; nextMessage: number;
};
export function createRoom(code: string, player: RoomPlayer): GuessRoom {
    return { code, version: 0, round: 0, phase: 'lobby', hostId: player.id, players: [player], settings: { category: 'random', chat: true }, category: null, board: [], turnId: null, winnerId: null, pendingQuestion: null, messages: [], nextMessage: 0 };
}
export function viewRoom(room: GuessRoom, playerId: string): GuessState {
    const me = room.players.find(p => p.id === playerId);
    if (!me) throw new Error('Join this room before continuing.');
    return { code: room.code, version: room.version, round: room.round, phase: room.phase, hostId: room.hostId, meId: playerId,
        settings: { ...room.settings }, category: room.category, board: room.board, turnId: room.turnId, winnerId: room.winnerId,
        pendingQuestion: room.pendingQuestion, messages: room.messages, secretId: me.secretId,
        players: room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected, picked: Boolean(p.secretId), skipNext: p.skipNext })),
        revealedSecrets: room.phase === 'finished' ? room.players.flatMap(p => p.secretId ? [{ playerId: p.id, cardId: p.secretId }] : []) : [] };
}
function message(room: GuessRoom, text: string, kind: GuessMessage['kind'] = 'notice', playerId?: string) {
    room.messages.push({ id: room.nextMessage++, text, kind, playerId });
    if (room.messages.length > 80) room.messages.shift();
}
function opponentOf(room: GuessRoom, playerId: string) {
    const opponent = room.players.find(p => p.id !== playerId);
    if (!opponent) throw new Error('Waiting for a second player.');
    return opponent;
}
function advanceTurn(room: GuessRoom, currentId: string) {
    let next = opponentOf(room, currentId);
    // Both players can owe a skipped turn. Consume each penalty in turn order.
    while (next.skipNext) {
        next.skipNext = false;
        message(room, `${next.name} skips a turn after a wrong guess.`);
        next = opponentOf(room, next.id);
    }
    room.turnId = next.id;
    room.pendingQuestion = null;
}
function sample<T>(items: T[], random: () => number) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
}
export function applyAction(room: GuessRoom, playerId: string, action: GuessAction, cards: GuessCard[], random: () => number = Math.random) {
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Join this room before continuing.');
    const hostOnly = () => { if (room.hostId !== playerId) throw new Error('Only the host can do that.'); };
    const activeTurn = () => {
        if (room.phase !== 'playing' || room.turnId !== playerId) throw new Error('Wait for your turn.');
        if (room.pendingQuestion) throw new Error('Wait for the answer to your question.');
    };
    if (['start', 'rematch', 'select', 'ask', 'answer', 'guess', 'end-turn'].includes(action.type) && (room.players.length !== 2 || room.players.some(p => !p.connected))) throw new Error('Waiting for both players to be connected.');
    switch (action.type) {
        case 'settings':
            hostOnly();
            if (room.phase !== 'lobby') throw new Error('Settings are locked during a round.');
            room.settings = { category: action.category, chat: action.chat }; break;
        case 'start': case 'rematch': {
            hostOnly();
            if (room.phase !== (action.type === 'start' ? 'lobby' : 'finished')) throw new Error('A round is already running.');
            const categories = [...new Set(cards.map(c => c.category))];
            const category = room.settings.category === 'random' ? categories[Math.floor(random() * categories.length)] : room.settings.category;
            const pool = cards.filter(c => c.category === category);
            if (pool.length < 20) throw new Error('This category does not have enough cards yet.');
            const previous = new Set(room.board.map(c => c.id));
            const fresh = sample(pool.filter(c => !previous.has(c.id)), random);
            const repeats = sample(pool.filter(c => previous.has(c.id)), random);
            room.board = sample([...fresh, ...repeats].slice(0, 20), random);
            room.category = category; room.round++; room.phase = 'choosing'; room.turnId = null; room.winnerId = null;
            room.pendingQuestion = null; room.messages = []; room.nextMessage = 0;
            for (const p of room.players) { p.secretId = null; p.skipNext = false; }
            message(room, 'Choose a secret card. Your opponent cannot see your choice.'); break;
        }
        case 'select':
            if (room.phase !== 'choosing' || player.secretId) throw new Error('Your secret is already locked in.');
            if (!room.board.some(c => c.id === action.cardId)) throw new Error('Choose a card from this board.');
            player.secretId = action.cardId;
            if (room.players.every(p => p.secretId)) {
                room.phase = 'playing'; room.turnId = room.players[(room.round - 1) % 2].id;
                message(room, `${room.players[(room.round - 1) % 2].name} goes first.`);
            } break;
        case 'ask':
            activeTurn();
            if (!room.settings.chat) throw new Error('Text chat is off. Ask aloud, then end your turn.');
            room.pendingQuestion = { playerId, text: action.text };
            message(room, action.text, 'question', playerId); break;
        case 'answer':
            if (room.phase !== 'playing' || !room.settings.chat || !room.pendingQuestion || room.pendingQuestion.playerId === playerId) throw new Error('There is no opponent question to answer.');
            message(room, action.answer, 'answer', playerId);
            advanceTurn(room, room.pendingQuestion.playerId); break;
        case 'end-turn':
            activeTurn(); message(room, `${player.name} ended their turn.`); advanceTurn(room, playerId); break;
        case 'guess': {
            activeTurn();
            const card = room.board.find(c => c.id === action.cardId);
            if (!card) throw new Error('Choose a card from this board.');
            const opponent = opponentOf(room, playerId);
            if (opponent.secretId === card.id) {
                room.phase = 'finished'; room.winnerId = playerId; room.turnId = null;
                message(room, `${player.name} guessed ${card.name} correctly and wins!`, 'guess', playerId);
            } else {
                player.skipNext = true;
                message(room, `${player.name} guessed ${card.name}. Wrong guess — their next turn is skipped.`, 'guess', playerId);
                advanceTurn(room, playerId);
            } break;
        }
        default: throw new Error('Unknown game action.');
    }
    room.version++;
}
