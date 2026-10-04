# Guess Who

## Product rules

The Trivia homepage links to a separate blue Guess Who homepage. A host creates a room, chooses celebrities, animals, foods or a random category, and chooses whether text chat is enabled. The room accepts exactly two players. Players can toggle Ready Up / Mark Not Ready in the lobby and after a round. Like Trivia, readiness is a signal for the host, who decides when to start; connecting alone does not mark a guest ready. Readiness resets when a new round starts. Both receive the same random 20-card board and privately lock a secret; choosing the same card is allowed.

Players take turns asking questions. With chat enabled, the current player submits one yes/no question and the opponent answers Yes, No or Not sure, passing the turn. With chat disabled, players talk in person or on their own call and use End Turn. Either mode allows a confirmed final guess instead of a question. A correct guess wins immediately; a wrong guess uses the current turn and skips the next, giving the opponent two consecutive turns. There is no timer or solo mode.

Crossing out cards and showing/hiding one's secret are local, immediate UI actions. Cross-outs survive reload in tab-scoped session storage and are never sent to the opponent. A rematch generates a fresh board, resets selections and penalties, and alternates the first player. Each category contains enough cards to avoid the preceding board entirely.

## Architecture and tradeoffs

`src/server/guess-who/engine.ts` owns the rules and per-player public view. `transport.ts` adapts the engine to the `/guess` Socket.IO namespace, using the existing Better Auth / guest identity middleware. Separate room types and namespace keep the existing trivia protocol unchanged. Mutating game commands require the latest room version; request IDs prevent duplicate commands from consuming another turn. Only a player's own secret is serialized until the round finishes.

`src/app/guess-who` owns the route UI and its connection provider. Layouts render without waiting for the backend; commands explain connection failures. A room marker distinguishes joining from reconnecting so a returning player sees a recovery panel rather than a join form or setup screen. Created rooms put their code in the URL for reload recovery. Clicking Create Game explicitly starts a new room, even after navigating away from a previous game.

The authoritative turn and win state lives on the existing Render server. Keeping rooms in memory avoids a database schema or new hosting service for this first version. Disconnections pause play and reserve the player's spot for 30 seconds. Leaving, or exceeding the reconnect grace period, ends an active round. Render restarts lose rooms; durable room persistence remains a separate follow-up. No database migration or new environment variables are needed.

## Catalogue and assets

The checked-in catalogue has 177 cards: 60 celebrities, 59 animals and 58 foods. Celebrities use reviewed names and Wikimedia Commons portraits; animal and food cards use Twemoji illustrations. All artwork is served locally, so gameplay has no dependency on third-party image hosts or catalogue APIs. The portrait files are 320px square WebP; the complete artwork is approximately 1.6 MB, and players load only the current board.

`src/lib/guess-who/catalogue.json` retains sources, creators and licenses. The credits page exposes individual portrait attributions and the Twemoji CC BY 4.0 credit. Wikidata contributes CC0 metadata. This is a curated starter collection, not an unrestricted runtime query of arbitrary celebrity images. See `guess-who-catalogue-research.md` for the source research and replacement options.

To refresh assets after reviewing the source list:

```sh
python3 scripts/import-guess-who.py
bun scripts/optimize-guess-who.ts
```

Existing assets are reused. Set `GUESS_REFRESH_IMAGES=1` when deliberately refreshing portraits, then run the optimizer. Review image crops and licenses before shipping a refresh.

## Validation

- 41 passing tests, including rule tests and real Socket.IO integration tests for secret isolation, ownership, stale/duplicate actions, reconnection, new-room creation and abandonment.
- ESLint, TypeScript and production build.
- React Doctor: 100/100, zero diagnostics.
- Two browser players: chat questions/replies, chat-off End Turn, wrong-guess penalty, correct win, identical secrets, private cross-outs, reload recovery, fresh rematch and leaving.
- Home, lobby and board reviewed at 320px, 390px, 844px landscape and 1024px; no horizontal overflow in the checked views. All 60 portrait crops reviewed.

No match statistics or rankings are recorded for this mode yet.
