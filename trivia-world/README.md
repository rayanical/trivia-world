# Trivia World

Next.js frontend and Bun/Express/Socket.IO backend. Neon Postgres stores accounts,
sessions, profiles, statistics, and resized avatars. Better Auth handles email/password
authentication; Resend sends verification and password reset links.

## Development

Install Node.js and Bun, then run `npm ci`. Copy `.env.example` to `.env.local` and
fill in the backend credentials. Use a separate development Neon branch or local
Postgres database. Never put credentials in variables prefixed with `NEXT_PUBLIC_`.

```sh
bun --env-file=.env.local run start:server
npm run dev
```

The backend runs on port 3001 and the frontend on port 3000. Starting the backend
applies migrations first. Migrations are serialized and recorded in the database;
subsequent starts preserve existing data. To apply them separately:

```sh
bun --env-file=.env.local run db:migrate
```

Migrations automatically use Neon's direct endpoint so the migration lock remains
on one database session. An optional `DATABASE_URL_UNPOOLED` overrides that endpoint.

## Deployment

The frontend is hosted on Vercel and the backend on Render. The frontend proxies
`/api/*` to Render so authentication cookies stay on the frontend's own domain.
Socket.IO connects directly to Render with the user's authenticated session token.

On **Render**, set the build command to `npm ci` and the start command to
`bun run start:server`. Set these environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon's pooled Postgres connection string with TLS enabled |
| `FRONTEND_URL` | `https://triviaworld.live,https://www.triviaworld.live` |
| `BETTER_AUTH_URL` | `https://www.triviaworld.live` |
| `BETTER_AUTH_SECRET` | A stable random secret of at least 32 characters |
| `RESEND_API_KEY` | Resend API key with sending access |
| `RESEND_FROM_EMAIL` | Sender address on an already verified Resend domain |

Render supplies `PORT`. Bun must be available in the runtime. An optional
`AUTH_TRUSTED_ORIGINS` accepts additional comma-separated frontend origins.

On **Vercel**, set `BACKEND_URL=https://api.triviaworld.live` (server only) and
`NEXT_PUBLIC_SOCKET_URL=https://api.triviaworld.live`, then rebuild. Configure
Render before deploying the frontend. Old Supabase keys are no longer used.
Set the same random `PROXY_SHARED_SECRET` on Render and Vercel. It authenticates
forwarded client IPs for per-player rate limits; keep it server-only.
This migration starts with fresh accounts and statistics; it does not import
Supabase data or delete the old Supabase project.

Google login is optional. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on
Render and register `https://www.triviaworld.live/api/auth/callback/google` as the
OAuth redirect URI. The UI shows Google login only when both variables exist.

Avatars are decoded, cropped to 256×256 WebP, and stored in Postgres with a
256 KB limit. No separate object storage service is required. Database storage
counts toward Neon usage. Authenticated statistics are updated on the server,
with duplicate answer/match receipts preventing repeated counts.

Render restarts preserve database contents but interrupt active multiplayer
matches, which are held in memory. Render's free service can sleep; Neon storage
survives that sleep. Neon's compute may also suspend when idle and resume on demand.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
```

Integration tests exercise verification/sign-in, profiles, avatar decoding,
password resets, solo ownership and scoring, and multiplayer statistics.
They require a **disposable local Postgres database**, reject remote database URLs,
and mock outgoing emails and the trivia provider. Migrate the test database first,
then run:

```sh
TEST_DATABASE_URL=postgresql://localhost/trivia_test bun test tests
```
