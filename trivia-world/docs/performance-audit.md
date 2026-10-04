# React and performance audit

Audit date: 2026-10-03. Baseline: `92a69d6`.

## Measurements

React Doctor 0.9.14 ran across the entire project with default rules, using
`npx react-doctor@latest . --yes --no-supply-chain --json`.
The dependency supply-chain service was excluded; npm's production dependency
audit is checked separately. No new diagnostic suppressions were added.

| Measurement | Before | After |
| --- | ---: | ---: |
| React Doctor score | 41/100 | 73/100 |
| Errors | 3 | 0 |
| Warnings | 55 | 8 |
| Homepage first-load JavaScript | 152 KB | 139 KB |
| Solo first-load JavaScript | 153 KB | 141 KB |
| Profile first-load JavaScript | 152 KB | 139 KB |
| Multiplayer first-load JavaScript | 156 KB | 156 KB |

JavaScript sizes are Next.js production-build estimates, not measured network
latency or frame rates. The multiplayer code moved out of the shared initial
bundle and still loads when multiplayer is entered.

## Changes

- Cleaned up both alert timers so an old alert cannot dismiss a newer one.
  Separated alert actions from state so toast changes do not redraw every page.
- Moved multiplayer reveal side effects out of React state updater callbacks.
  Countdown intervals no longer restart every second and stop at expiration.
- Deferred Socket.IO and closed authentication-modal code until needed; preload
  solo navigation and multiplayer code on hover or focus.
- Removed the external Material Symbols stylesheet/font in favor of four SVGs.
- Centralized static categories and removed effects that only load constants.
- Added a bounded solo question buffer, request cancellation, synchronous
  duplicate-click guards, immediate submission feedback, and replay without a
  browser reload. Ready questions remain available while prefetching runs.
- Made profile statistics independent of profile edits, cancelled obsolete
  requests, added retry feedback, and reset local state when accounts change.
  Invalid avatar uploads retain the previous image instead of a failed preview.
- Added native keyboard/touch category selects, associated field labels,
  guarded lobby settings, and a directly clickable timer switch.
- Authentication now uses a native modal dialog with focus containment,
  Escape dismissal, restored focus, autofill hints, and Enter submission.
  Connection failures appear inside the dialog as well as the global alert.
- Added request timeouts and useful messages for non-JSON gateway responses.
- Pinned PostCSS to 8.5.28 in both package manager lockfiles, removing the
  production dependency advisories. Full npm audit still flags development-only
  glob parsing dependencies, including an unpatched `braces` advisory.
- Added three bounded attempts for transient migration startup connection errors;
  invalid credentials fail immediately and migration SQL is never retried.
- Respected reduced-motion preferences for scrolling and animations.

## Verification

- 18 regression tests / 74 assertions pass, including gateway errors and request
  cancellation and startup retry classification. Existing authentication, avatar, statistics, joins, ties, and
  reconnect integration tests pass against disposable local Postgres.
- Production build, TypeScript checks, ESLint, and diff whitespace checks pass.
- Real-browser checks covered category selection with the keyboard, sign-in
  dialog dismissal, solo answer feedback, replay, and advancing through ready
  questions while a fixture delayed the next batch by 12 seconds.
- Real-browser multiplayer checks covered deferred connection setup, invalid
  settings feedback, clicking the timer switch, scoring, and reveal behavior.

## Remaining diagnostics

Four warnings concern complexity: authentication, solo rendering, and the large
multiplayer component (both size and complexity). Smaller setup and profile
statistics components were extracted, but rewriting the complete multiplayer
state machine solely to improve a score is outside this focused change.

Four warnings concern asynchronous cleanup. They were reviewed: the profile
request owns an AbortController, aborts in effect cleanup, and gates state writes
on its signal. Its loading reset is in `finally`. Solo loading/submission resets
are also in `finally`, guarded by request identity so an obsolete request cannot
clear a newer request's busy state. No suppressions hide these diagnostics.

## Follow-up priorities

1. Persist active multiplayer rooms across backend deployments/restarts.
2. Monitor the bounded Neon startup retry behavior and update development-only
   glob dependencies when compatible patched releases are available.
3. Design question caching around freshness and repeat avoidance. Keep answer
   scoring and ownership server-side; never cache sessions or personal stats
   publicly.
4. Isolate countdown rendering and extract the multiplayer state model before
   adding new game modes or AI-generated questions.
5. Measure real interaction latency on a production mobile connection before
   adding broad memoization or additional caching libraries.

Render's free instance can still sleep. This audit improves UI behavior and
client work; it does not remove infrastructure cold starts or guarantee the
absence of every bug.
