# Project 28: The Universe of Us

The **October 27 one-month anniversary** now has its own automatically scheduled
Oreo experience and live preview. It requires no draft-saving or manual release.
See [ANNIVERSARY.md](ANNIVERSARY.md). The workflow below applies only to the
separate, preserved **28-day universe journey**.

## Owner workflow

Sign in as Zaahid and open **Project 28 studio** in the existing sidebar (open the
mobile navigation first). The recipient account sees no Project 28 entry or
content while release is off.

1. Personalize the nickname and draft letter. Replace the deliberately generic
   chapter text with real memories, add chapter photographs and an optional voice
   recording, and customize the 28 distinct starter notes.
2. Save the private draft. Unsaved edits block Preview/Release so the saved version
   cannot be mistaken for a new unsaved letter.
3. Preview the seven scenes, including the finale, and finish with the return
   button. Only the owner's progress is written; her progress is untouched.
4. Test the actual soundtrack on your phone. The exact supplied URL is the default:
   `https://htmlhoster.com/p/PHVR6X52/videoplayback.m4a`. If it fails, use the
   **same-song replacement** file input with an authorized copy of that recording.
   No alternative song is silently substituted.
5. Click **Release to her account** and confirm. The backend requires a completed
   owner preview. Ask her to open/reload the site after release. A currently open
   unreleased chat does not poll for release changes.

The production configuration was created with **released = false** and
`opens_at = 2026-10-25T00:00:00+05:30`. The date is a lower bound, not a one-day
window: a later release works. Only the slot-2 account gets the automatic reveal,
after about three seconds of normal chat. Explicit exit stores dismissal; refresh
can otherwise resume the saved scene. Completion prevents further automatic
starts. The permanent garden and voluntary replay remain in the sidebar.

## Experience

The seven scenes are the quiet interruption, recognizable Pip/portal, four-week
constellation universe, three interactive discoveries, editable paper letter,
permanent garden, and a held celestial finale. Text and scene advancement are
user-controlled. Challenges collect five stars, discover three sentence pieces,
and connect five ordered lights; all can be skipped without losing the finale.
The final hug uses a stable message UUID and confirms only after the existing
message RPC succeeds. Preview hugs do not send anything.

The aesthetic is a bespoke celestial storybook: high visual variety (8), deliberate
cinematic motion (7), and low density (3). Existing chat styling is preserved.
Cormorant/Manrope and the already-installed local Allura handwriting are reused
instead of adding more font downloads. Layered CSS/SVG art, finite shooting stars,
constellation drawing, small spring entrances, paper and Pip replace heavy WebGL
or a new game engine. Native touch/keyboard controls and reduced-motion variants
are provided. Scene scroll resets on scene changes and stays steady for interactions
inside a scene. The original chat DOM and draft are retained beneath the overlay.

Project 28 assets load only after an authorized configuration read succeeds.
Unreleased recipient accounts do not load the journey code or styles. Scene state
and game progress use the backend; localStorage stores only the sound preference.
There is no new polling or permanent per-frame JavaScript loop. Photo preparation
uses the existing image worker and compression limits, strips metadata and
cancels on exit. Audio is one persistent instance across scenes, starts after a
user gesture, fades, loops, supports mute, pauses when hidden, and is ducked under
the optional native voice player. Voice playback stops when leaving its scene.
Audio and asset failures never gate story progression.

## Permanent garden and private data

The tree blossoms with actual stored memories and opens their collection. The
collection supports text and optional compressed photographs, with earlier-memory
pagination. The jar reads the owner's 28 saved notes. Pip's home uses the existing
character and leaves existing pet XP/care data untouched. The soundtrack shelf
supports owner-uploaded meaningful songs, up to 20; these are explicit additions.

Both accounts can seal future letters. The capsule RPC returns title/date/author
metadata before the unlock time and returns the body only after **server time**
passes it. Moving a browser clock forward does not unlock anything. Direct table
reads have no SELECT policy. Even the author cannot retrieve the sealed body via
the API before its date; the author necessarily knew what they typed originally.

The additive hosted migration is recorded as
`project28_additive_private_experience`; `supabase/project28.sql` is its reviewed
source, **not a script to rerun against an existing installation**. It adds four
new RLS tables, a guarded capsule-list function and a private `project28` bucket.
Existing message, photo, member, account, location and game schemas are untouched.
Uploads are limited to approved image/audio types and 10 MB; photos compress to
at most the existing 512 KiB limit. Signed media links expire after ten minutes
and refresh on later requests. Pausing release prevents new recipient config and
storage reads, but cannot erase already displayed content or immediately revoke
an issued link. This is private authenticated storage, not end-to-end encryption.

The capsule-list RPC intentionally runs as SECURITY DEFINER to return sealed
metadata without granting direct body reads. It has an empty search path,
fully qualified tables, explicit member/release checks, no anonymous/PUBLIC
EXECUTE grant, and tests for outsider/anonymous denial. Supabase reports its
[authenticated SECURITY DEFINER advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
for this intentional guarded API; it is not an unauthenticated privileged endpoint.

## Verification and limits

The private pre-change row/object-metadata backup is
`work/pre-project28-backup.json`, mode 0600, excluded from Git and deployment.
SHA-256: `bb9c44da25b7d2928f63e6184bf88006e5412cc6f69eb5714460108c215be326`.
It is a verified JSON snapshot, not a binary photo export or full PostgreSQL dump.
Comparison after the migration found all **3,489 messages and 18 photo records**,
three favorites, twenty reactions, seventeen garden events, twenty-two island
completions, inventory, placements, wallet and surprise records unchanged. No
backup was restored over live activity. Both account identities remain intact.

Live SQL tests under authenticated owner/recipient/outsider and anonymous roles
verify owner access, unreleased/future-date hiding, released access, recipient
release-write denial, private asset date gates, upload path ownership, sealed
capsule bodies, direct body-read denial and RPC outsider/anonymous denial. All
security fixtures run inside transactions and are rolled back. The live release
flag remains false and no test memories/capsules/media objects are left behind.

`npm test` includes date/content checks. `npm run test:project28` exercises two
isolated Chromium clients with controlled Supabase HTTP/WebSocket/storage
transports: owner editing, all seven scenes, all challenges, preview isolation,
release/resume/completion, unread message delivery behind the overlay, idempotent
hug, garden memories/capsules, worker photo upload, signed images, native voice
playback, same-song upload plumbing, small screens, long letters, reduced-motion
pseudo effects, private soundtrack retry failure recovery and 6x CPU garden interactions. Existing chat/photo/garden/island/
location/link/three-hearts regressions remain in CI. Media fixtures use synthetic
PNG/WAV data and do not establish playback of the actual external song.

The soundtrack host is blocked by this workspace's outbound policy. Actual song
availability, MIME/range support and mobile/Safari playback therefore remain
unverified; test them in owner preview before release or upload the authorized
same-song file. Physical-device battery use, Safari and authenticated production
two-phone browser transport are also not established by local controlled tests.
No paid services, new dependencies or component downloads were introduced.

Frontend rollback baseline: commit `126aee9c70ed641df864314eb7d8b0c7421c7d65`,
deployment `dpl_4FFp9iFuPHrJAdXUTJEXMp3GnvVi`. A frontend rollback leaves the new
private data intact. Do not drop/reset new or existing tables to roll back UI.
