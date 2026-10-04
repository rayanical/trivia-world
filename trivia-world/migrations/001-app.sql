CREATE TABLE IF NOT EXISTS user_stats (
    user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    solo_questions_answered integer NOT NULL DEFAULT 0,
    solo_questions_correct integer NOT NULL DEFAULT 0,
    solo_easy_correct integer NOT NULL DEFAULT 0,
    solo_medium_correct integer NOT NULL DEFAULT 0,
    solo_hard_correct integer NOT NULL DEFAULT 0,
    multiplayer_games_played integer NOT NULL DEFAULT 0,
    multiplayer_games_won integer NOT NULL DEFAULT 0,
    multiplayer_questions_answered integer NOT NULL DEFAULT 0,
    multiplayer_questions_correct integer NOT NULL DEFAULT 0,
    multiplayer_easy_correct integer NOT NULL DEFAULT 0,
    multiplayer_medium_correct integer NOT NULL DEFAULT 0,
    multiplayer_hard_correct integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS avatars (
    user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    data bytea NOT NULL CHECK (octet_length(data) <= 262144),
    content_type text NOT NULL DEFAULT 'image/webp' CHECK (content_type = 'image/webp'),
    version text NOT NULL
);

-- Event receipts prevent retries or duplicate socket events from inflating stats.
CREATE TABLE IF NOT EXISTS stat_events (
    event_id text NOT NULL,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS solo_questions (
    id uuid PRIMARY KEY,
    user_id text REFERENCES "user"(id) ON DELETE CASCADE,
    guest_token_hash text,
    difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    correct_answer text NOT NULL,
    answers jsonb NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '1 day',
    answered_at timestamptz,
    selected_answer text,
    CHECK (user_id IS NOT NULL OR guest_token_hash IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS solo_questions_expiry ON solo_questions(expires_at);
