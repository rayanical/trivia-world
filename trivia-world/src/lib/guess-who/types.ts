export const guessCategories = [
    { id: 'random', name: 'Random category', description: 'A surprise category each round' },
    { id: 'celebrities', name: 'Celebrities', description: 'Familiar faces from music, movies and sport' },
    { id: 'animals', name: 'Animals', description: 'Creatures big, small, furry and scaly' },
    { id: 'foods', name: 'Foods', description: 'Fruit, treats and things to eat' },
] as const;
export type GuessCategory = typeof guessCategories[number]['id'];
export type GuessCard = { id: string; name: string; image: string; category: Exclude<GuessCategory, 'random'> };
export type GuessSettings = { category: GuessCategory; chat: boolean };
export type GuessPlayer = { id: string; name: string; connected: boolean; ready: boolean; picked: boolean; skipNext: boolean };
export type GuessMessage = { id: number; playerId?: string; kind: 'question' | 'answer' | 'guess' | 'notice'; text: string };
export type GuessState = {
    code: string; version: number; round: number; phase: 'lobby' | 'choosing' | 'playing' | 'finished' | 'abandoned';
    hostId: string; meId: string; players: GuessPlayer[]; settings: GuessSettings;
    category: Exclude<GuessCategory, 'random'> | null; board: GuessCard[]; secretId: string | null;
    turnId: string | null; winnerId: string | null; pendingQuestion: { playerId: string; text: string } | null;
    messages: GuessMessage[]; revealedSecrets: { playerId: string; cardId: string }[];
};
export type GuessAction =
    | { type: 'create'; name: string; fresh?: boolean }
    | { type: 'join'; name: string }
    | { type: 'state' } | { type: 'leave' } | { type: 'start' } | { type: 'rematch' } | { type: 'return-lobby' } | { type: 'end-turn' }
    | { type: 'ready'; ready: boolean }
    | { type: 'settings'; category: GuessCategory; chat: boolean }
    | { type: 'select'; cardId: string } | { type: 'guess'; cardId: string }
    | { type: 'ask'; text: string } | { type: 'answer'; answer: 'Yes' | 'No' | 'Not sure' };
export type GuessRequest = { requestId: string; code?: string; version?: number; action: GuessAction };
export type GuessReply = { state?: GuessState; error?: string };
