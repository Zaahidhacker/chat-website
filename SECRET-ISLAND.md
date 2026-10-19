# Our Secret Island — initial release

An additive adventure inside Our Little Universe. Existing messaging, photos, notifications and Moon Garden remain the primary app and retain their data. Open **Our secret island** in navigation. No new paid dependency, service, image API, game server or subscription is used.

## Playable content

Six original SVG environments: the cottage, Moonflower Garden, Whisperwood and Stargazer’s Rise are open initially. Four distinct restored story lights unlock Glasswater Cove; eight unlock the lighthouse. Twelve lights complete three written chapters. Either partner’s discoveries open shared paths; either person can finish the entire story alone.

- **Star Catcher:** three 45-second rounds with increasing speed and targets; blue and golden stars, purple clouds, combo bonuses, touch-to-catch or a sliding basket, keyboard controls and an explicit pause/resume. Only this short arcade game is timed.
- **Memory Mystery:** four-, six- and eight-pair levels, using different-sized boards and an expanding illustrated symbol set; unlimited attempts, no timer.
- **Secret Code:** three uniquely solvable logic locks: position/direction clues, a linked ordering puzzle, and an exactly-one-true-statement puzzle. Feedback supports deduction; there is no attempt limit.
- **Constellation Puzzle:** progressively larger kite, sailing boat and home charts. Tap pairs of stars to restore each line; extra stars act as distractors. No timer or forced waiting.

Each game has instructions, an objective, a win condition and local replay. Four deterministic daily variations rotate boards, symbols/clues, star waves and charts without server content downloads. Eight environmental curiosities and four personal field badges reward exploration. Original story text is bundled; no generated-content API is called.

The shared cottage has 14 unlockable pieces in seven placement categories, including wallpapers, rugs, furniture, plants, lights and window decorations. Previews do not spend stars. Purchase once, then place owned pieces for free. Each place has its own revision, so unrelated edits coexist and stale same-place edits require refresh/reselection.

Optional hidden notes are separate from chat. Send up to three a day, with a conservative 200-note total capacity; no automatic deletion occurs at capacity. The recipient’s API response contains **no note text** before opening. Opening requires completing a story challenge at that location. The sender can always see their own note. Notes do not trigger chat notifications. Pip appears as a companion in the garden, using the original garden points and crown threshold; the original Moon Garden remains available unchanged.

## Data and concurrency

`island_private` contains only new catalog, completions, wallet, inventory, placements and surprise tables. RLS is enabled and direct client table access is revoked. Two exposed RPC wrappers are `SECURITY INVOKER`; their private implementations check authoritative two-account membership and have empty search paths. Anonymous execute permissions are revoked. No editable user metadata authorizes access.

A short, game-only advisory transaction lock serializes wallet/reward/purchase/placement operations. It uses a different lock from chat and garden, and makes no external calls while locked. Unique `(user_id, challenge_id, day_key)` completion keys prevent duplicate rewards. A shared item can be bought once; retries do not charge twice. Placement revisions prevent stale overwrites. Surprise UUIDs make send retries idempotent.

Code and constellation solutions and complete memory-board coverage are validated by Postgres. Arcade results are bounded, client-reported scores; this is a private cooperative game, **not a competitive anti-cheat system**. The server controls fixed rewards and their frequency; clients cannot choose reward amounts or write wallet rows.

Successful story rewards never expire. Daily rewards use the played day in Asia/Colombo, from the release date onward, and cannot be claimed for a future day. Earned daily completions queued during a long disconnection can still save later. The normal response returns only recent daily completion markers while retaining all reward records for deduplication.

Meaningful completions and surprise sends enter an account-scoped local queue before RPC submission. A lost acknowledgement or temporary connection failure is retryable, including after reload. The queue holds at most 80 entries; further discoveries require syncing first. Cottage previews remain local and purchases/placement need a confirmed save. Sign-out clears local island state and pending actions; save waiting discoveries before signing out. Browser storage eviction/clearing can discard unsynced actions. No authoritative island state or received partner notes are persistently cached in the browser.

## Performance and free infrastructure

No game engine, animation library, new font or image download is needed. Original SVG artwork, CSS and game logic load only on entering the island. Existing content-hashed public-asset caching also caches static island assets. Private game state and surprise content never enter the service-worker cache.

Only Star Catcher uses a rendering loop, bounded to 30 updates/second with a small active object set. Other games update on interaction. Hidden or unmounted games pause; a return does not burn arcade time. Reduced-motion disables decorative transitions, and audio is opt-in and synthesized locally. No island polling or realtime subscription exists. State requests happen on entry, Refresh, explicit Retry and meaningful actions. Existing chat presence/delivery behavior continues independently.

The main app keeps its 25,000-byte gzip initial JS/CSS budget. Island JS/CSS together are approximately 23 KB gzip, loaded separately on first entry. All infrastructure remains the existing Supabase Free and Vercel Hobby project; provider storage/database/egress quotas and inactivity pausing still apply. See [the earlier capacity research](PHOTO-GARDEN.md), [Supabase pricing](https://supabase.com/pricing), [database function security](https://supabase.com/docs/guides/database/functions) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). The current changelog was checked; no new dependency or platform migration is required.

## Preservation and rollout

Before DDL, an owner-authorized private snapshot captured 515 messages, two identities, current preferences/reactions/saved/hidden state, existing garden records and photo metadata/storage-object records. At capture there were two garden events and no photo rows or storage objects. JSON was parsed, message IDs verified unique, and its file SHA-256 recorded as `8d4c55239107f3c3e60cce38d756486f47cea26962eed5fb327228525c0a7933`. Backup and comparison SQL remain mode 0600 in ignored `work/`, excluded from GitHub and deployment.

The upgrade only creates the new island schema and RPCs. Migrations 013 and 014 correct new island slot validation and preserve long-offline rewards; neither touches existing chat, photo, garden or account rows. Migration 015 covers the new placements furniture reference with an index. The local Supabase CLI bootstrap was unavailable in this runtime, so the reviewed SQL files were applied through the hosted migration connector. Never reset the database or replay the old initial migrations on production.

Rollback: restore the previous Vercel app deployment/commit `09e1be6b3ae78e8c5e9175d00efb64097b5f9216`. Leave the new additive island schema in place so discoveries remain available when the island is re-enabled. No history restore or destructive down migration is needed. The previous app does not depend on island tables.

## Verification boundaries

`npm test` checks all adventure content, unique lock solutions, deck integrity, chart geometry/proofs, deterministic daily generation, chapter deduplication and scoring rules alongside existing unit tests.

`npm run test:island` plays all 12 challenges through the real Chromium UI and real Supabase SDK with two isolated users on a controlled test-only network transport. It tests shared unlocks, replay rewards, curiosities, cottage previews/purchases, stale placement conflicts, sealed-note discovery, lost acknowledgements/reload, connection recovery, daily memory, background pausing/no game polling, chat delivery while using the island, touch input, reduced motion, 320–1440 px themes and CPU-throttled response. Other browser suites retain text, photos, login, notification-handler and Moon Garden regressions.

`tests/island-database.sql` tests actual Supabase functions in a rolled-back transaction: all 12 catalog proofs, daily reward deduplication, direct-table/outsider/anonymous denial, locked paths, invalid results, purchase retries, slot revisions, different-place edits, note redaction and earned opening. It refuses fixtures once real island activity exists. It never writes to old chat/photo/garden tables.

The runtime still restricts direct browser traffic to live Supabase/Vercel origins. Actual database permission/transaction tests and deployed static delivery are verified with native connectors. Live two-device island HTTP exchanges, physical-device camera/pinch/push behavior and Safari performance are not proven by Chromium’s controlled transport. Offline gameplay means a previously loaded island can continue through connection loss; this is not a promise of cold-start offline login.
