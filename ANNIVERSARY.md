# One-month anniversary: Oreo’s secret

The anniversary is included in the application build. It has **no Save Draft,
Publish, recording, upload, or manual activation step**. Zaahid can use
**Anniversary live preview ♡** in the sidebar, or the anniversary card at the top
of Project 28 Studio. Both use the actual experience. Owner previews never write
recipient progress. The older 28-day journey, its saved letter, notes, garden,
media and release flag remain separate and unchanged.

## Release and recovery

The database enforces **27 October 2026, 00:00 Asia/Colombo**, which is
**26 October 2026, 18:30 UTC**. There is no expiry window. Only the existing slot-2
authenticated partner receives the automatic opening after three seconds of normal
chat. Zaahid’s slot-1 account gets only the private preview. Both accounts retain
manual replay in the sidebar.

`anniversary_2026_status()` is a SECURITY INVOKER RPC. It supplies server time,
release time, permitted letter content and the account’s saved place. Before the
release instant, recipient RLS hides the letter. A single timer rechecks the
server at the release boundary; visibility, focus and reconnect recheck it too.
No device calendar decides eligibility. A currently open tab needs to have loaded
the new application version to run new code.

The separate anniversary progress table records started state, the current scene,
last completed scene/dialogue, normalized letter reading position, completion and
a server completion timestamp. An interrupted viewing automatically returns on a
later visit with **Continue where I left off ❤️** / **Start from the beginning 🤭**.
Very early, non-meaningful progress simply starts again. Letter scroll checkpoints
coalesce to about one write every two seconds while reading and restore an
approximate position across different phone sizes. Scene checkpoints are saved
as the story advances, with best-effort final reading saves on background/exit;
recovery does not rely on a browser-close request.

Opening, closing, skipping ahead, reading the letter and previewing do not finish
anything. The final **Gnn 😂❤️** line must fully appear and finish its three-second
pause before the story can enter the resting scene and save completion. Its
Continue control is disabled, so it cannot be skipped into a completed state.
The SECURITY INVOKER `anniversary_2026_checkpoint` RPC requires the final dialogue
checkpoint for completion. It atomically preserves completion and its timestamp
if another device later saves an unfinished scene or restarts/replays. The older
save RPC signature remains for compatibility, without a completion bypass.
Failed writes show no false success; reconnect and the final return button retry
an unsaved completion. The letter has unlimited reading time and advances only
through its bottom button.

The overlay retains the underlying chat DOM, draft and scroll. Existing receipt
logic leaves incoming messages unread while the app is inert. Oreo and the
three-hearts secret do not overlap. Existing Project 28 overlays close before the
anniversary opens, and vice versa. Exit, focus trapping and Escape remain available.
No message is sent by the anniversary.

## Art and music

Oreo is one original, layered SVG cockatiel: upright crest, peach cheek patches,
long tail, expressive eyes and coherent wing/head/crest poses. Blinks, flutters,
hops, reveal particles and entrances have finite animations. Only transform and
opacity animate. Typewriting and motion pause when hidden; reduced motion shows
complete dialogue and suppresses decorative motion. Local Cormorant, Manrope and
Allura fonts are reused. Main letter paragraphs use readable Manrope.

The supplied recording is integrated without substitution:

`https://htmlhoster.com/p/E1P7QWAA/Ayed-Awedak-Lirik-Arab-dan-Terjemahan-Terbaru-Viral-Tiktok.mp3.mpeg`

One native audio instance loops across the story. The first line attempts
playback, with an integrated gesture control if blocked, a truthful music state,
mute preference, fade-in/out, background pause and retry. No optional assets are
required. Autoplay handling follows the
[MDN media autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

**Actual recording playback remains unverified:** the managed workspace returns
CONNECT 403 for htmlhoster.com, and the available web reader also cannot fetch
this audio. Consequently its response MIME type, real encoding, range support,
availability and physical-phone compatibility cannot be confirmed. The original
URL is retained; no alternate recording, paid service or remote fetching bypass
was introduced. Browser tests exercise playable synthetic WAV media, explicit
autoplay rejection and media failure, not the supplied song. Physical iPhone
volume behavior still needs a device check.

## Database safety

`supabase/anniversary-2026.sql` is the reviewed installation source, not a script
to rerun. Hosted migration history records `anniversary_2026_oreo_automatic_release`,
`anniversary_2026_atomic_completion` and
`anniversary_2026_resume_checkpoints`. They only add/extend two anniversary tables,
RLS policies, SECURITY INVOKER functions and the supplied letter. They do not
change any existing chat, photo, account, pet, game, location, Project 28 or
Storage records or schemas. Anonymous/outsider access is denied. Owner preview
cannot write recipient progress. No service key or personal credential is added
to browser code.

The pre-change private JSON backup is `work/pre-anniversary-backup.json` (0600,
excluded from Git and deployment). SHA-256:
`c936f04610abd777c300090dc3e56277678eb5bd46f33b6333347b54bb9fea5b`.
It includes 4,060 messages, 18 photo rows, existing Project 28 content/progress,
memories/capsules, members and basic account identities. It is a row snapshot,
not a full database dump or photo-binary backup. Existing photo bytes are never
touched. Post-change full-row comparison found zero missing or changed baseline
messages, photo records, saved Project 28 records or account identities. No
snapshot was restored over live activity.

Native authenticated SQL tests verify owner preview, owner-write denial,
recipient access/resume/completion, rejection of early completion, timestamp and atomic completion preservation, and outsider
and anonymous denial. Fixtures run in rolled-back transactions. No real recipient
completion is written by testing. Security advisors report no new anniversary
findings; existing unrelated guarded SECURITY DEFINER and password advisories
remain as documented in PROJECT28.md.

## Verification

`npm test`, `npm run build`, `npm run test:anniversary`, and the existing browser
suites cover the implementation. Anniversary browser tests use controlled
HTTP/WebSocket/media fixtures, actual app SDK/UI and isolated authenticated
identities. They cover the full exact story, all nine letter paragraphs, owner
Studio/live preview, resume from another device, completion/replay, release
boundary crossing, failed saves, truthful audio controls, persistent media across
scenes, hidden-page pause, reduced motion and six-times CPU throttling. Eleven scenarios also cover all requested interruption points, a visit eight hours later, Continue/Restart, cross-device reading position and final-goodbye gating.

Responsive checks include 360×800, 375×812, 390×844, 430×932, 768×1024 and
1440×900. The browser executed is Chromium. WebKit installation was attempted,
but both official download hosts were blocked by network policy; Safari/WebKit
and physical-phone coverage are not claimed. There is no repository TypeScript
or lint script; JavaScript syntax, unit tests and the production build are checked.
Production HTTP and asset verification is recorded in VERIFICATION.md separately
from controlled browser tests and live SQL authorization tests.

For rollback, restore the preceding application deployment/commit. The additive
anniversary objects can stay in place unused. Do not delete or restore any chat
history, media, existing Project 28 content or account data to roll back this UI.
