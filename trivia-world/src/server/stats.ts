import type { Pool, PoolClient } from 'pg';

type Executor = Pick<Pool | PoolClient, 'query'>;
export type Difficulty = 'easy' | 'medium' | 'hard';

// Both names come from a fixed allowlist; all user-controlled values are parameters.
export async function recordQuestion(db: Executor, userId: string, eventId: string, mode: 'solo' | 'multiplayer', difficulty: Difficulty, correct: boolean) {
    const answered = `${mode}_questions_answered`;
    const totalCorrect = `${mode}_questions_correct`;
    const bucket = `${mode}_${difficulty}_correct`;
    await db.query(`
        WITH receipt AS (
            INSERT INTO stat_events (event_id, user_id) VALUES ($1, $2)
            ON CONFLICT DO NOTHING RETURNING user_id
        )
        INSERT INTO user_stats (user_id, ${answered}, ${totalCorrect}, ${bucket})
        SELECT user_id, 1, $3, $3 FROM receipt
        ON CONFLICT (user_id) DO UPDATE SET
            ${answered} = user_stats.${answered} + 1,
            ${totalCorrect} = user_stats.${totalCorrect} + $3,
            ${bucket} = user_stats.${bucket} + $3
    `, [eventId, userId, correct ? 1 : 0]);
}

export async function recordGame(db: Executor, userId: string, eventId: string, won: boolean) {
    await db.query(`
        WITH receipt AS (
            INSERT INTO stat_events (event_id, user_id) VALUES ($1, $2)
            ON CONFLICT DO NOTHING RETURNING user_id
        )
        INSERT INTO user_stats (user_id, multiplayer_games_played, multiplayer_games_won)
        SELECT user_id, 1, $3 FROM receipt
        ON CONFLICT (user_id) DO UPDATE SET
            multiplayer_games_played = user_stats.multiplayer_games_played + 1,
            multiplayer_games_won = user_stats.multiplayer_games_won + $3
    `, [eventId, userId, won ? 1 : 0]);
}
