# The Three Hearts Secret

Sending a new message containing a complete run of `❤️❤️❤️` starts an eight-second
romantic scene on connected, visible clients. Text around the hearts is allowed.
Four or more adjacent red hearts, separated hearts, other heart colors, edits,
deleted messages and unconfirmed/failed sends do not start it. The original
message is stored and displayed normally; the scene never rewrites its content.

| Time | Scene |
| --- | --- |
| 0–1.2 s | Chat fades beneath near-black rose/plum light; a tiny red heart appears. |
| 1.2–3 s | Three gradient hearts approach on soft springs, pulse and merge into pink light. |
| 3–6 s | Locally hosted Allura handwriting reveals “I love you,” above “more than words could ever say.” Rose-gold/white/pink petals, little hearts and stars drift around it. |
| 6–8 s | The declaration, light and particles dissolve; the same chat DOM returns. |

## Motion and delivery

Installed the requested `motion` dependency and ran the official `npx motion-ai`
installer in the project root (Codex/project scope). The initial non-terminal CLI
invocation requested a terminal; rerunning interactively completed installation.
The installed skill's universal, CSS-versus-Motion and vanilla JavaScript best
practices guide this implementation. The app is vanilla JavaScript, so it uses
free Motion DOM timelines and springs rather than introducing React. Motion is
pinned to 14.6.0; the Allura font is pinned to 5.3.0 and distributed with its OFL
license. Motion's MIT license is distributed with the build.

[Motion AI Kit](https://motion.dev/docs/ai-kit) installs self-contained best
practices and optional hosted tools. Hosted documentation tools are not connected
in this assistant session; local installed guidance and installed API types were
used. No Motion+ components, account, subscription, paid API, Lottie download or
remote animation/font request is required by the website.

Confirmed INSERT events use the existing private Postgres Changes subscription.
The sender also observes its successful `universe_send` response, covering an
acknowledgement arriving without an echo. The existing revision replay can join
a fresh, missed scene after a brief interruption. No extra channel, broadcast,
RPC, database row, migration, timer-based network poll or backend service is added.

Both clients derive the timeline from the stored server `created_at` plus a
900 ms loading lead. A slower client seeks into the same timeline instead of
restarting at zero. The chat remains usable while scene assets load. This is
best-effort synchronization: network latency and device clock skew can affect
alignment; device clocks should be set automatically. A device that is offline
or suspended for the whole scene cannot display it simultaneously. Messages more
than eight seconds old are ignored by the effect; historical heart messages do
not replay on login or when paging. Hidden/background pages don't start an effect;
a running one is dismissed when hidden and does not replay on return.

A bounded, account-scoped list of the last 128 consumed message IDs in session
storage deduplicates realtime events, send acknowledgements, reconnects and
reloads. It stores no message text or photos. If storage is unavailable, in-memory
deduplication still works for the current page. A distinct new trigger replaces
an active scene; it never builds an animation queue or piles up particle layers.

## Accessibility and performance

The effect overlays the existing DOM. Messaging/realtime delivery continues
underneath. Skip and Escape dismiss locally without dismissing the partner's
scene. The overlay traps focus, makes underlying chat/dialog controls inert, and
restores the prior focus with `preventScroll`. Existing draft and message nodes
are retained. Reduced motion shows the declaration without moving hearts or
particles. A blocked Motion chunk degrades to the same static declaration; a
failed font uses a local fallback. Sign-out invalidates pending scene imports.

Only transforms and opacity animate. Light textures and tiny drop shadows remain
static. There is no per-frame JavaScript callback, large blur animation, canvas,
video, remote asset, sound autoplay, or permanent decorative loop. Phone scenes
use 28 particles; desktop uses 44. Stop/skip/visibility change removes the overlay,
Motion controls, listeners and active timers. No new work is scheduled once done.

Initial JavaScript/CSS remains below the unchanged 25,000-byte gzip guard. The
scene, styles, Motion adapter (about 24.5 KB gzip) and 26.5 KB handwritten font
load only for a fresh trigger and use hashed asset URLs. Motion is exported
through a small adapter so the entire dynamic module namespace is not bundled.
The first scene can arrive late or be skipped if a very slow connection cannot
load it within the animation window; normal message delivery still completes.

## Preservation, verification and rollback

No SQL, account changes, storage changes, message deletion/rewriting or progress
changes are involved. Tests use fictional accounts and controlled Supabase HTTP
and WebSocket transports; no live personal records were written. Source changes
are additive UI hooks and assets. No backup restore is needed or performed.

`npm test` includes five new policy cases. `npm run test:hearts` runs fourteen
real-browser scenarios with two isolated desktop/mobile clients. They cover both
directions, late peer loading, canonical timing, ordinary message delivery during
the effect, scroll/draft/node/focus preservation, local Skip/Escape, duplicates,
edits, four hearts, reload, reduced motion, failed-send retry, automatic ending,
background cleanup, overlapping secrets, small portrait/landscape sizes, 6× CPU,
sign-out during an asset load, a blocked Motion chunk, and reconnect catch-up.
Existing messaging, photos, garden/island, links and location suites remain in CI.
These tests do not establish physical iPhone behavior, battery use or exact
internet two-phone synchronization. Production-origin authenticated browser
traffic is blocked by this workspace's network policy.

Rollback to `389829b9f545a90b60d8b864b66bbacdcdc6bc8f` / Vercel deployment
`dpl_GgYASAHiwwnE8xYnGLbuEN7DB4Bx` removes this feature without a data rollback.
