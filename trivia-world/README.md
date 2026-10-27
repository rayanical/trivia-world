<div align="center">
  <img src="public/logo.png" alt="Trivia World logo" width="96" height="96" />
  <h1>Trivia World</h1>
  <p>Solo trivia, real-time multiplayer, and two-player Guess Who.</p>
  <p><a href="https://www.triviaworld.live/">Play online</a> · <a href="../README.md">Full project guide</a></p>
</div>

This directory contains the Next.js frontend and Bun/Express/Socket.IO backend.
Neon Postgres stores accounts, sessions, profiles, trivia statistics and avatars;
Better Auth and Resend handle account sign-in and email. Guess Who uses a bundled,
curated card catalogue and private server-managed secrets.

## Run from this directory

Install Node.js 24.22.1 or a newer 24.x patch, npm and Bun, prepare a development Postgres database, then:

```sh
npm ci
cp .env.example .env.local
```

If you use nvm, run `nvm install` and `nvm use` before `npm ci`.

Fill in `.env.local` using the [configuration guide](../README.md#configuration),
then run these commands in separate terminals:

```sh
bun --env-file=.env.local run start:server
```

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). Backend startup applies migrations;
the backend defaults to port 3001.

> [!IMPORTANT]
> Active rooms are held in server memory and do not survive backend restarts.
> Accounts, avatars and trivia statistics persist in Postgres.

See the [repository README](../README.md) for prerequisites, environment variables,
deployment, tests and the project map. The [Guess Who guide](docs/guess-who.md)
documents game rules, card sourcing and artwork credits.

The runtime is selected by `.nvmrc` / `.node-version` and constrained in
`package.json`. Vercel manages the latest patch in the selected 24.x line. On
Render, an explicitly configured `NODE_VERSION` overrides the version file; keep
that override updated or remove it to use `.node-version`. The game backend itself
runs on Bun.
