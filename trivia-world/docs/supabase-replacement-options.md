# Replacing Supabase

Research checked October 3, 2026. The final decision is **Neon Postgres**, Better Auth, Resend, and small avatars stored directly in Postgres. The backend stays on Render and the frontend on Vercel. The user chose a fresh database with no import of existing Supabase accounts or statistics. See [README](../README.md) for the implemented architecture, configuration, and tests.

The research below records the earlier SQLite/Blob proposal and alternatives considered; it is not the current deployment plan.

## Feature replacements

| Current feature | Recommended replacement | Reason |
| --- | --- | --- |
| Email/password, sessions, password resets | Better Auth | Built-in credential auth and reset flows; email delivery remains a supplied callback. [Docs](https://better-auth.com/docs/authentication/email-password) |
| Google sign-in | Better Auth Google provider | Supports Google OAuth; configure a client ID, secret, and new callback URL. [Docs](https://better-auth.com/docs/authentication/google) |
| Profiles and statistics | SQLite through Bun on the existing backend | Bun has a built-in driver, and Better Auth accepts `bun:sqlite` directly with schema migration support. [Bun](https://bun.sh/docs/runtime/sqlite), [Better Auth](https://better-auth.com/docs/adapters/sqlite) |
| Avatar bucket | Public Vercel Blob store | Avatars are a documented use case; public files are accessible to anyone with their URL. [Docs](https://vercel.com/docs/vercel-blob) |
| Verification/reset emails | Resend | SDK works with Bun; production sending requires a verified owned domain. [SDK](https://resend.com/docs/send-with-nodejs), [Domains](https://resend.com/docs/dashboard/domains/introduction) |
| Database authorization and statistics RPCs | Authenticated backend routes and transactions | Application design recommendation: derive identity from the session, check ownership server-side, and calculate multiplayer outcomes on the game server. |
| Multiplayer realtime | Existing Socket.IO | Repository observation: game state already lives in `server.ts`; Supabase is not its realtime transport. |

Repository scope: `AuthContext.tsx`, `AuthModal.tsx`, profile/reset-password pages, solo/lobby statistics calls, and `supabaseClient.ts` use Supabase. `package.json` runs the multiplayer backend with Bun and uses Express 5. No database schema or RLS policies were found in the inspected source, so production export/schema inspection remains necessary.

## Deployment and integration

Put the SQLite file on a persistent backend volume, with one authoritative database-writing deployment and off-server backups. SQLite is suitable behind an application server, but serializes writes and is a less natural fit when many application servers must write the same database. [SQLite guidance](https://www.sqlite.org/whentouse.html)

The Next frontend may remain on Vercel. Keep the writable SQLite database on the persistent Bun server: Vercel Functions do not provide shared durable local storage. Vercel Blob is object storage for avatars, not the live SQLite database. [Vercel guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)

Mount Better Auth on the backend. Its Express integration covers session lookup and credentialed CORS; Express 5 requires the documented named wildcard route, and the auth handler must precede body parsing. [Express integration](https://better-auth.com/docs/integrations/express)

Prefer a shared parent domain (`app.example.com` and `api.example.com`) or proxy HTTP auth/API calls through the frontend domain. Configure trusted origins and credentialed requests, and only share cookies across subdomains when needed. Unrelated provider domains can break cookie sessions under Safari's third-party-cookie protections. WebSocket authentication also needs explicit session validation at connection time. [Cookie guidance](https://better-auth.com/docs/concepts/cookies)

Vercel Blob can be called from a backend hosted outside Vercel by supplying its server-only token. For small avatars, a bounded backend upload is simple; direct browser uploads use a server-issued token. Authorize uploads before minting that token, constrain size/type and ownership, and associate completion with the session's user. Save the new avatar reference before deleting the old object. [SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), [Client uploads](https://vercel.com/docs/vercel-blob/client-upload)

## Alternatives

- **Clerk:** a managed alternative with Next.js components and SDK integration. Prefer it if minimizing auth operations matters more than keeping authentication data in our SQLite database; it introduces another managed identity dependency. [Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
- **Auth.js:** supports Next.js and Express, but Better Auth's built-in password/reset support makes it the recommended fit here. This preference is an assessment, not an assertion that Auth.js is unsupported. [Auth.js](https://authjs.dev/)
- **Cloudflare R2:** alternative object storage using an S3-compatible API; attractive when provider portability matters, with more storage configuration than the proposed Blob path. [API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- **SMTP via Nodemailer:** use an existing transactional SMTP provider instead of Resend's API. Nodemailer supplies the transport, not the mail-delivery service. [SMTP transport](https://nodemailer.com/smtp)

## Existing-account migration

Better Auth publishes a Supabase migration guide that imports users and provider accounts, preserving IDs and credential hashes. Supabase uses bcrypt while Better Auth defaults to scrypt, so configure compatible bcrypt verification for imported passwords. Existing users can potentially retain passwords without a forced reset. The published example targets PostgreSQL; adapt its inserts and schema to SQLite rather than running it unchanged. [Migration guide](https://better-auth.com/docs/guides/supabase-migration-guide)

Preserve user IDs across auth, profiles, and statistics; import Google provider identities; update OAuth redirects; copy avatars and rewrite URLs; verify both migrated credential and Google logins in staging. Expect a fresh login at cutover rather than assuming Supabase sessions remain valid. Migration feasibility depends on export access and the actual production schema. These are implementation checks, not blockers to the proposed stack.

## Proposed sequence

1. Confirm durable backend storage and production export access.
2. Introduce SQLite migrations, Better Auth, and authenticated backend profile/statistics routes.
3. Integrate Resend and Blob; validate reset, OAuth, sessions, ownership, and upload completion.
4. Import a staging dataset and verify login, profile, stats, and avatars.
5. Export a final snapshot, cut over, and test backup restoration before removing Supabase.

The tradeoff is direct control of data and fewer Supabase-specific APIs, with responsibility for backend availability, schema migrations, auth-library updates, and backups. Blob and Resend retain managed delivery/storage services where operating them ourselves adds little value.
