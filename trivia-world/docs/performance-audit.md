# React and performance audit

Audit date: 2026-10-03. Baseline: `92a69d6`.

## Measurements

React Doctor 0.9.14 ran across the entire project with default rules, using
`npx react-doctor@latest . --yes --no-supply-chain --json`.
The dependency supply-chain service was excluded; npm's production dependency
audit is checked separately. No new diagnostic suppressions were added.

| Measurement | Before | After |
| --- | ---: | ---: |
| React Doctor score | 41/100 | 100/100 |
| Errors | 3 | 0 |
| Warnings | 55 | 0 |
| Homepage first-load JavaScript | 152 KB | 139 KB |
| Solo first-load JavaScript | 153 KB | 141 KB |
| Profile first-load JavaScript | 152 KB | 139 KB |
| Multiplayer first-load JavaScript | 156 KB | 157 KB |

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

## React Doctor 100 follow-up

The full default-rule scan now reports **100/100, zero errors, and zero warnings**
across 55 analyzed files (React Doctor 0.9.14). No rule exclusions, inline
suppressions, or scan-scope reductions were added. The same `--no-supply-chain`
setting used for the baseline is retained; this score covers React Doctor's
code analysis, not its external dependency service.

- Extracted lobby joining, setup, questions, and results into separate views,
  with narrow typed props. The existing socket lifecycle remains in one
  controller hook so state and timers retain their original ownership.
- Separated the authentication dialog, fields, form, and auth request handling.
  React 19's form-action API retains native validation and Enter submission.
- Extracted solo question and results views without changing scoring or replay.
- Solo busy indicators now derive from the pending request identity. Finalizers
  release only their own task, preserving the guard against stale completions.
- Profile requests explicitly mark effect cleanup as ignored and abort the
  request. Success, failure, and finalization all respect that lifecycle.

The UI is easier to maintain, but component extraction adds approximately 1 KB
of multiplayer first-load JavaScript in the build estimate. It does not claim a
runtime speed improvement on its own.

Verification: the production build and ESLint pass; all 18 regression tests /
74 assertions pass. Browser checks confirm Enter submits the auth form, failed
sign-in restores the submit control, reset mode returns to sign-in, Escape
restores focus, solo scoring/replay works, and multiplayer setup/scoring/results
work against a disposable local backend.

## Immediate interaction follow-up (2026-10-04)

Solo question batches now include the answer key intentionally: casual solo play
reveals correctness and updates the visible score synchronously. Server-side
answer validation and idempotent statistics remain authoritative. Multiplayer
answers remain hidden until reveal. This trades solo answer secrecy for immediate
feedback; it does not make competitive multiplayer client-scored.

- A tab-scoped sessionStorage outbox saves selected answers independently of the
  game component, retries temporary failures with bounded exponential backoff,
  isolates accounts, and reports permanently unsaved answers. It survives
  navigation/reload within the tab. Closing the tab is best-effort (`keepalive`),
  not guaranteed durable delivery; expired questions can no longer be saved.
- Solo setup/hover prefetches a batch. The client retains at most four filter and
  account combinations for five minutes, consumes each batch once, and starts
  replenishing with five ready questions still available.
- The backend has a consumable question pool with at most 12 filter combinations
  and a ten-minute lifetime, sharing concurrent refill work. Issued entries are
  removed from the pool; upstream providers can still repeat question text.
- Homepage multiplayer connections start quietly after the session is ready.
  The create button opens the final lobby immediately while room creation
  finishes. The same controls remain mounted; a code is shown only after server
  confirmation. Slow connection feedback starts after 400 ms in reserved space.
- Room replies have request identities. Cancelled late replies leave the room,
  rather than resolving a newer entry request or stranding a player in a lobby.
- Profile statistics refresh when the background answer backlog finishes.
- An older-backend compatibility path verifies solo answers remotely until the
  deployed backend supplies answer keys.

Verification: 27 tests / 106 assertions passed, covering queue ownership/reload,
transient/permanent failures, both caches, late room replies, and existing
integration behavior. Full React Doctor remains 100/100 with zero diagnostics.
Build/lint/type checks pass. In a real browser with answer saves delayed by five
seconds, feedback and Next were already available within a 285 ms tool round trip;
a deliberately failed save retried successfully. A five-second room creation delay
left category/difficulty/count editable and preserved those settings in the real
lobby. This is functional evidence, not a claim of a measured 285 ms paint time.

The latest production build estimates are 141 KB for home/profile, 143 KB for
solo, 160 KB for lobby, and 161 KB for multiplayer. Multiplayer now loads the
shared gameplay view once instead of loading setup and then a second route.
Hosting remains unchanged and room persistence is deferred as requested.

## Single-click multiplayer stability

Room creation now uses the same shared lobby view before and after confirmation.
It updates the room code and resumable URL in place, without redirecting to a
second page. Settings, focus, heading, player row, and button labels stay stable;
connection and question preparation messages have reserved space. Start remains
disabled until a confirmed room and connection are available. Shared join links
still use `/lobby/CODE`; the creator can reload `/multiplayer?room=CODE`.

Browser verification with room creation delayed five seconds: the question-count
input retained value `3`, focus, and identical coordinates (400, 340) across the
reply. The creator route stayed mounted. Reload recovered the room, and starting,
answering, and finishing a one-question game worked. Full React Doctor remains
100/100 with zero diagnostics.

## Feature readiness and multiplayer polish (2026-10-04)

- Reconnecting a player now broadcasts the restored connection to the other
  players. Non-member recovery requests return an explicit error instead of
  silently waiting. Regression tests reproduced both failures before the fix.
- Expired creator rooms disable Start and invite actions and offer Create New Room
  in the existing layout. Replacement creation preserves the chosen settings.
  Returning Home with browser Back leaves the previous room; Forward gives clean
  recovery if it has ended. State requests wait for membership on join routes.
- Start, rematch, and answer handlers have synchronous duplicate-action guards.
  Failed preparation restores the previous server phase, including finished
  results, and informs the room. Reconnect during preparation keeps that phase.
- Lobby invite links support copying with manual-copy feedback when clipboard
  access fails. QR generation runs locally in a separately loaded component using
  [node-qrcode](https://github.com/soldair/node-qrcode); it never sends the invite
  to an external QR service. A separate macOS Vision decoder verified the exact
  generated join URL from a browser screenshot.
- Ready status is owned by each player, broadcast to the room, and reset for the
  next match. It is advisory: the host retains control over starting. Results
  include a host-only Rematch action that reuses server-stored settings, gets
  another consumable question batch, and resets answers and scores.
- A five-second delayed rematch left results visible, showed preparation feedback,
  and disabled repeated actions. Two browser players completed a match/rematch;
  refreshing recovered the active question and scores.

The lobby, question, and results views had no horizontal overflow at a real
390-pixel iframe viewport. A temporary local harness observed browser
[Event Timing](https://www.w3.org/TR/event-timing/) entries for timer toggling,
QR opening, answer selection and rematch: approximately 32–48 ms through the next
paint, rounded by the browser. These are local development samples on this
computer, not production mobile INP percentiles or a cold-start measurement.
No blanket memoization or additional caching was justified by this check.
The temporary harness was removed before deployment.

Verification: 31 tests / 123 assertions cover existing auth, solo, cache and
multiplayer behavior plus readiness ownership, duplicate starts, non-host rematch
rejection, failed preparation, clean expired-room recovery and fresh rematch
scores/settings. Production dependency audit reports zero advisories. Full React
Doctor remains 100/100 with zero diagnostics; build, lint and type checks pass.

## Follow-up priorities

1. Persist active multiplayer rooms across backend deployments/restarts.
2. Monitor the bounded Neon startup retry behavior and update development-only
   glob dependencies when compatible patched releases are available.
3. Design question caching around freshness and repeat avoidance. Keep answer
   scoring and ownership server-side; never cache sessions or personal stats
   publicly.
4. Isolate countdown rendering and simplify the multiplayer state model before
   adding new game modes or AI-generated questions.
5. Measure real interaction latency on a production mobile connection before
   adding broad memoization or additional caching libraries.

Render's free instance can still sleep. This audit improves UI behavior and
client work; it does not remove infrastructure cold starts or guarantee the
absence of every bug.
