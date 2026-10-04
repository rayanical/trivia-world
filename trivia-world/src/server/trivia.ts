import { QuestionPool } from './question-pool';
import { randomInt } from 'node:crypto';
import type { Difficulty } from './stats';

export const categories = ['general_knowledge', 'film_and_tv', 'music', 'science', 'history', 'sport_and_leisure', 'geography', 'arts_and_literature', 'society_and_culture', 'food_and_drink'];
export type Question = { question: string; category: string; difficulty: Difficulty; correct_answer: string; incorrect_answers: string[] };

export function shuffle<T>(values: T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

async function loadQuestions(amount: number, category?: string, difficulty?: string): Promise<Question[]> {
    if (!Number.isInteger(amount) || amount < 1 || amount > 50) throw new Error('Question count must be 1–50.');
    if (category && !categories.includes(category)) throw new Error('Invalid category.');
    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) throw new Error('Invalid difficulty.');
    const url = new URL('https://the-trivia-api.com/v2/questions');
    url.searchParams.set('limit', String(amount));
    if (category) url.searchParams.set('categories', category);
    if (difficulty) url.searchParams.set('difficulties', difficulty);
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Question provider is unavailable. Please try again.');
    const data: unknown = await response.json();
    if (!Array.isArray(data) || !data.length) throw new Error('No questions available. Please try again.');
    return data.map((q) => {
        if (!q || typeof q.question?.text !== 'string' || typeof q.correctAnswer !== 'string' ||
            !Array.isArray(q.incorrectAnswers) || !q.incorrectAnswers.every((answer: unknown) => typeof answer === 'string') ||
            !['easy', 'medium', 'hard'].includes(q.difficulty) || typeof q.category !== 'string') {
            throw new Error('Question provider returned an invalid response.');
        }
        return { question: q.question.text, category: q.category, difficulty: q.difficulty, correct_answer: q.correctAnswer, incorrect_answers: q.incorrectAnswers };
    });
}

const questionPool = new QuestionPool(loadQuestions);
export async function fetchQuestions(amount: number, category?: string, difficulty?: string): Promise<Question[]> {
    // Validate even on a cache hit; untrusted filters never create arbitrary cache keys.
    if (!Number.isInteger(amount) || amount < 1 || amount > 50) throw new Error('Question count must be 1–50.');
    if (category && !categories.includes(category)) throw new Error('Invalid category.');
    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) throw new Error('Invalid difficulty.');
    return questionPool.take(amount, category, difficulty);
}
