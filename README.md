<div align="center">
  <img src="trivia-world/public/logo.png" alt="Trivia World logo" width="112" height="112" />
  <h1>Trivia World</h1>
  <p>Play trivia. Challenge your friends. Guess their secret.</p>
  <p>
    <a href="https://www.triviaworld.live/">Play Trivia</a> ·
    <a href="https://www.triviaworld.live/guess-who">Play Guess Who</a> ·
    <a href="#getting-started">Run locally</a> ·
    <a href="#project-map">Explore the code</a>
  </p>
</div>

Trivia World is a browser game built with Next.js, React and TypeScript, with a
Bun/Express backend for real-time multiplayer. Play as a guest, or create an
account to save your trivia statistics and customize your profile.

## Game modes

| Mode | How it works |
| --- | --- |
| **Solo trivia** | Pick a category and difficulty, answer multiple-choice questions, and get immediate answer feedback. Ready questions are prefetched and answer saves retry in the background. |
| **Multiplayer trivia** | Invite friends with a room code, link or QR code. The host chooses the category, difficulty, question count and optional timer. Players answer together, see results, and can rematch. |
| **Guess Who** | Two players share a randomized 20-card board and privately choose a secret. Ask yes/no questions, cross out cards privately, and guess your opponent's choice. Play with text questions or talk in person/on your own call. |

Guess Who includes **celebrities, animals and foods**, plus a random-category
option. A wrong guess uses the current turn and skips the next; a correct guess
wins. Rematch with a fresh board or return both players to the lobby to change
settings. Ready indicators are advisory; the host decides when to start.

Accounts support verified email/password sign-in, password resets, optional Google
sign-in, profile avatars, and server-recorded trivia statistics. Guess Who does
not record rankings or match statistics yet.

## How it is built

| Part | Implementation |
| --- | --- |
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4 |
| API and real-time games | Bun, Express 5, Socket.IO 4; a separate `/guess` namespace for Guess Who |
| Database | Postgres, hosted on Neon in production |
| Accounts and email | Better Auth and Resend |
| Avatars | Validated, cropped 256×256 WebP images stored in Postgres; no object storage service |
| Hosting | Vercel frontend and Render backend |

The browser sends `/api/*` requests through Next.js to the backend, keeping auth
cookies on the frontend's domain. Socket.IO connects directly to the backend.
The server owns multiplayer turns, scoring and private secrets; only each
player's own Guess Who secret is sent to them until the round finishes.

> [!IMPORTANT]
> Accounts, avatars and trivia statistics persist in Postgres. Active rooms live
> in server memory: backend restarts interrupt games, and running multiple game
> server instances requires additional room coordination. Render's free service
> can sleep; the frontend renders while it reconnects in the background.

## Getting started

You need **Node.js 24.22.1 or a newer 24.x patch with npm**, **Bun**, and a **Postgres database**. Use a local
database or a separate Neon development branch. Resend credentials and a verified
sender are required for the backend's account email configuration.

```sh
git clone https://github.com/rayanical/trivia-world.git
cd trivia-world/trivia-world
npm ci
cp .env.example .env.local
```

If you use nvm, run `nvm install` and `nvm use` in the app directory before
`npm ci`. The checked-in `.nvmrc` and `.node-version` select the patched runtime.

Fill in `.env.local` using the configuration below. Generate separate random
values for `BETTER_AUTH_SECRET` and `PROXY_SHARED_SECRET`; for example:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Start the backend and frontend in **separate terminals**, from the app directory:

```sh
# Terminal 1: apply database migrations, then start the game/API server
bun --env-file=.env.local run start:server
```

```sh
# Terminal 2: start Next.js
npm run dev
```

Open [localhost:3000](http://localhost:3000). The backend defaults to port 3001;
`GET /health` checks its database connection. Trivia questions require access to
The Trivia API; Guess Who artwork is bundled locally.

### Configuration

[`.env.example`](trivia-world/.env.example) contains the local defaults. In
production, put frontend variables on Vercel and backend variables on Render.

| Variable | Where | Purpose |
| --- | --- | --- |
| `BACKEND_URL` | Frontend, server only | API proxy destination; locally `http://localhost:3001` |
| `NEXT_PUBLIC_SOCKET_URL` | Frontend, public | Socket.IO destination; locally `http://localhost:3001` |
| `PROXY_SHARED_SECRET` | Both, server only | Same random value on both services; verifies forwarded client IPs for rate limits |
| `DATABASE_URL` | Backend | Postgres connection string; use TLS for Neon |
| `FRONTEND_URL` | Backend | Allowed frontend origins, comma-separated; locally `http://localhost:3000` |
| `BETTER_AUTH_URL` | Backend | Public frontend URL used for auth links and callbacks |
| `BETTER_AUTH_SECRET` | Backend | Stable random secret, at least 32 characters |
| `RESEND_API_KEY` | Backend | API key for account email delivery |
| `RESEND_FROM_EMAIL` | Backend | Sender on a verified Resend domain |
| `PORT` | Backend | Local port, default 3001; supplied by Render in production |

Optional backend variables: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable
Google sign-in together; `AUTH_TRUSTED_ORIGINS` adds comma-separated origins;
`DATABASE_URL_UNPOOLED` overrides the direct migration connection.

> [!WARNING]
> Keep `.env.local` out of Git. Only `NEXT_PUBLIC_SOCKET_URL` belongs in the public
> browser configuration; database credentials, auth secrets and email keys must
> remain server-side.

### Database migrations

Backend startup applies Better Auth and application migrations before listening.
Applied application migrations are recorded and checked; startup preserves
existing data. To migrate separately:

```sh
bun --env-file=.env.local run db:migrate
```

For Neon, migrations automatically resolve the pooled hostname to its direct
endpoint so the migration lock stays on one session. Keep an applied migration
unchanged; subsequent schema changes need a new migration and an update to the
migration runner.

## Deployment

Run commands below from `trivia-world/`, the app directory inside the repository.

| Service | Build | Start / configuration |
| --- | --- | --- |
| **Vercel** | `npm run build` | Set project root to `trivia-world`; use the Next.js framework preset. Set `BACKEND_URL` and `NEXT_PUBLIC_SOCKET_URL` to the backend's HTTPS URL. |
| **Render** | `npm ci` | Set root directory to `trivia-world` and start command to `bun run start:server`. The runtime must provide Bun. Configure the backend variables above. |

Node.js is constrained to `>=24.22.1 <25`, including the
[October 21 security fixes](https://nodejs.org/en/blog/release/v24.22.1). Vercel
selects the latest patch in the 24.x line. Render uses `.node-version` unless a
`NODE_VERSION` environment override is configured; update or remove an older
override. The game server still runs on Bun.

Configure the backend before deploying the frontend. Set the same
`PROXY_SHARED_SECRET` on both services and rebuild after changing a
`NEXT_PUBLIC_*` variable. For the current deployment:

- Frontend: `https://www.triviaworld.live`
- Backend: `https://api.triviaworld.live`
- Allowed frontend origins: `https://triviaworld.live,https://www.triviaworld.live`
- Optional Google callback: `https://www.triviaworld.live/api/auth/callback/google`

## Checks and tests

```sh
npm run lint
npm run typecheck
npm run build
```

The Bun suite covers auth, avatars, scoring, background saves, question buffering,
room recovery, readiness, Guess Who secret isolation, turn rules and lobby return.
Integration tests mock outgoing email and the trivia provider. They require a
**disposable local Postgres database** and reject remote database URLs.

```sh
export TEST_DATABASE_URL=postgresql://localhost/trivia_test

# Create the empty test database beforehand, then initialize its schema.
DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL_UNPOOLED="$TEST_DATABASE_URL" \
  bun --env-file=.env.local run db:migrate

bun test tests
```

Use separate databases for development, tests and production.

## Card sources

Guess Who uses a reviewed catalogue of **169 cards**: 60 celebrities, 51 animals
(without birds), and 58 foods. Animal and food artwork comes from Twemoji;
celebrity names and portraits are imported through Wikidata and Wikimedia Commons.
Images and attribution metadata are checked in, so starting a match does not call
an external image or catalogue API. Individual image credits are available
[in the app](https://www.triviaworld.live/guess-who/credits).

To refresh the approved source lists and optimize downloaded portraits:

```sh
python3 scripts/import-guess-who.py
bun scripts/optimize-guess-who.ts
```

This optional import requires Python 3 and network access. Review recognizability,
image crops and individual licenses before publishing new cards. See the
[Guess Who guide](trivia-world/docs/guess-who.md) for refresh behavior and rules.

## Project map

| Path | Contents |
| --- | --- |
| `trivia-world/src/app/` | Pages, game screens and the API proxy |
| `trivia-world/src/server/` | Auth, Postgres, trivia provider and Guess Who rules/transport |
| `trivia-world/src/lib/` | Shared types, catalogue and client buffering/save helpers |
| `trivia-world/server.ts` | Express and Socket.IO entry point; trivia room lifecycle |
| `trivia-world/migrations/` | Application database schema |
| `trivia-world/tests/` | Bun unit and integration tests |
| `trivia-world/scripts/` | Migrations and catalogue import tools |
| `trivia-world/public/` | Logo, social images and bundled card artwork |

Further reading: [Guess Who implementation](trivia-world/docs/guess-who.md),
[card source research](trivia-world/docs/guess-who-catalogue-research.md), and
[performance work and measurements](trivia-world/docs/performance-audit.md).
