# Our Little Universe

A private chat with photo sharing and a shared moon garden for Zaahid and Layaana. Built with vanilla JavaScript, a lazy-loaded Supabase client, Supabase Auth and Postgres row-level security. The production host is Vercel, with source in `Zaahidhacker/chat-website`.

## Develop and verify

```sh
npm ci
npm test
npm run build
npm start
# Once on a development machine:
npx playwright install --with-deps chromium
npm run test:browser
npm run test:upgrades
npm run test:features
npm run test:island
npm run test:links
npm run test:location
npm run test:overhaul
```

The build enforces a 25 KB gzip budget for initial JavaScript plus CSS. Assets have content hashes and long-lived cache headers. Only the public application shell is cached; auth and message responses are never stored by the service worker.

## Messaging and efficiency

- Immediate local message feedback, stable UUID retries, authoritative server order and timestamps.
- PostgreSQL change subscriptions, with revision-based replay on reconnect; edits and tombstones also replay.
- Fifty-message history pages, at most 100 rendered bubbles on phones and 200 on laptops. Older history remains available through paging.
- Keyed message elements: unchanged bubbles stay in place; presence, typing and read receipts update separately.
- Coalesced receipt requests, no unchanged database receipt writes, and one visible-tab presence heartbeat every 30 seconds.
- After 30 seconds in the background, the socket closes. Returning reconnects and fetches changes. If realtime is unavailable, the visible tab checks for changes every 30 seconds.
- Drafts and failed sends survive reload within the same tab. Closing a tab may discard them. Compressed unsent photos use a separate, account-scoped IndexedDB outbox capped at 8 MiB. Sign-out clears private in-memory state and both outboxes.
- Self-hosted Latin Manrope and Cormorant fonts, with content hashes and persistent public-asset caching. No third-party font requests, analytics or autoplay. The fonts add about 48 KB on a cold visit, then are cached.
- Touch swipe right to reply, with vertical-scroll arbitration and an accessible menu alternative. Original reply context is fetched only when missing, subject to message RLS.
- Browser sessions persist through normal visits and token refresh. Temporary conversation fetch failures offer reconnect without deleting the stored session. Private/incognito mode, revoked sessions, cleared browser storage and provider outages still apply.

## Access and enrollment

Exactly two administrator-approved invitation slots exist in the database. Account names are bound to their approved emails. Invitation codes are never committed to this repository.

Each person chooses **First time here? Set your password**, enters their email and private invitation, chooses a password of at least 12 characters, and verifies their email. The four-digit passwords originally requested were not configured. Database membership is authoritative; editable user metadata does not authorize chat reads or writes. The one-time signup code is checked against its server-side hash before enrollment.

**Supabase Authentication URL Configuration must use the final Vercel production URL as Site URL and an allowed redirect URL.** This setting cannot be changed through the connected database tools. Confirm that email delivery is configured for both invited addresses. Supabase's built-in mail service has delivery and rate restrictions; these were not verified from this environment. No SMTP subscription or paid integration was added.

## Privacy

HTTPS and account access protect messages; this is **not end-to-end encryption**. Service administrators can access stored data.

Clear Chat stores a per-account sequence boundary, follows the account across devices and never deletes the partner's history. Saved Keepsakes survive clearing. Hide removes a message only for the acting account. An author can replace their own message for both accounts with a tombstone. Replies to cleared or hidden messages do not reveal the quoted content.

Security-definer operations are limited to the authenticated role, check membership and ownership, and use a fixed empty search path. Direct message and profile writes are not granted to clients. The private invitation table intentionally has no client policies. The security advisor flags the explicitly authorized security-definer operations for manual review; none of the chat RPCs is anonymously executable.

## Verification boundaries

`tests/database.sql` runs against the **actual Supabase database**, creates fixture members inside a transaction and rolls back everything. It refuses to run once real members or messages exist. It checks both directions, replies, author-only editing, retry deduplication, personal clear isolation, saved messages, >100-message revision replay, read/delivery semantics, redundant receipt suppression and outsider/anonymous denial.

`npm run test:browser` runs the real application and Supabase SDK in two isolated browser contexts against an explicitly labeled **test-only HTTP/WebSocket transport**. It covers sending both ways, receipts, edits, reactions, lost acknowledgements, 120 missed messages, offline edits, bounded history, unread messages while reading older history, personal clear, Keepsakes, reload-safe retry, sign-out, a 6× CPU-throttled phone, and cold load at 1.6 Mbps with 150 ms latency. Test transport code is not imported into production.

The execution workspace blocks direct Supabase API and Vercel-origin browser network access. The user has independently confirmed live enrollment and two-way messaging. Automated live authenticated WebSocket delivery and physical-device push delivery have **not** been verified. Native backend tools verified the live database and push webhook authentication. The test fixture's timings are not real internet round-trip measurements. See `VERIFICATION.md` for recorded results.

## Deployment and budget

`vercel.json` builds the static `dist` output. The GitHub workflow runs unit checks, the budgeted build and browser integration tests without account secrets. Deployments use Vercel's GitHub connection; no service-role key is present in the browser.

The connected Vercel team uses **Hobby**, and the Supabase organization was verified on **Free**. Free quotas, inactivity pausing, GitHub Actions allowances and provider policies still apply. No purchased domain, paid API, storage plan or billing integration is used.

## Phone notifications

In Settings, choose **Manage phone notifications** on each device. Permission is requested only after this action. Android Chromium supports Web Push; on iPhone/iPad, use iOS/iPadOS 16.4+ and add the site to the Home Screen before enabling notifications. Browser and operating-system support, permission settings, battery restrictions and network availability govern actual delivery. If notifications are already enabled, the control offers to turn them off.

`supabase/009_private_push.sql` is an **additive upgrade** for the existing database. Do not rerun the initial migrations or reset an in-use database. New subscription records are private to their account, limited to five devices, and restricted to known HTTPS browser push providers. The database queues an asynchronous webhook only for a new message with a recipient subscription. No browser needs to remain open. The edge function looks up the authoritative sender and excludes their subscriptions. Edits, retries of an existing message UUID, and historic messages do not emit a new-message webhook.

The function `universe-push` authenticates the database webhook with a randomly generated, constant-time checked secret. Its platform `verify_jwt` setting is false because this is a webhook; its own authentication remains mandatory. VAPID private keys and webhook secrets live in Supabase Vault. Only a service-role RPC can retrieve them; browsers can retrieve the public VAPID key only after membership validation. The live deployment has already been provisioned; do not regenerate these keys without planning subscription re-enrollment.

The service worker receives only recipient/message IDs, displays **“You have a new message.”**, verifies the active account, suppresses notifications for a focused open chat, and handles clicks by focusing or opening the app. Sign-out clears its account association and closes visible notifications. Service worker storage contains no conversation bodies or login credentials. Push is best effort: provider/network failures are logged without private data, expired endpoints are removed, duplicate webhook calls are claimed once per device, and a failed notification never rolls back a message. There is no durable retry scheduler for failed provider deliveries.

Before this upgrade a private workspace backup of existing conversations and account identities was saved and verified with the owner's explicit approval. All 28 baseline message records were compared against the database and were exactly unchanged after the additive migration. The backup, generated signing keys and private comparison SQL stay in ignored `work/`; none is committed or deployed.

## Photos and our moon garden

The composer’s photo button offers gallery selection and native camera capture where supported. Photos are decoded and re-encoded on the device, with a 1600-pixel maximum edge, a 512 KiB full-image ceiling and a 32 KiB thumbnail ceiling. A preview and optional caption appear before any upload. Uploads go directly to two private Supabase buckets with progress and stable-ID retries. Conversation thumbnails load near the viewport; full images load only on opening the viewer. The viewer supports zoom, scrolling/panning, native pinch zoom and JPEG download. Original EXIF metadata is removed; HEIC/AVIF decoding depends on browser support. Unsupported formats receive an actionable error.

**Our moon garden** is a separate navigation item: care for Pip the bunny, water the shared garden, answer a sealed daily question, match moon pairs and solve a daily symbol code. Shared points unlock flowers, a lantern, Pip’s crown and a wishing pond. Rewards are limited to once per activity per person per day by the server. Puzzles use an honor system; they are not competitive anti-cheat games. Game state loads on entry, explicit refresh and actions, with no game polling. Optional sound is generated locally and starts off. Hidden or unmounted game activity pauses.

Only the additive migrations `010_private_photos.sql` and `011_shared_garden.sql` were applied for this upgrade. They add separate tables, buckets and membership-checked functions. They do not alter, rewrite or recreate existing conversations or accounts. The verified private backup and comparison SQL remain excluded from source and deployment. **Do not reset this production database.**

See [PHOTO-GARDEN.md](PHOTO-GARDEN.md) for official free-tier research, capacity limits, privacy details and verification boundaries.

## Our Secret Island

Open **Our secret island** from navigation for a three-chapter illustrated adventure: six locations, twelve story challenges across four playable games, daily variations, eight hidden curiosities, personal badges, a shared cottage with fourteen decorations and optional sealed surprise notes. The original Moon Garden and Pip’s progress stay intact. Games run locally between meaningful saves; hidden games pause and no island polling runs. See [SECRET-ISLAND.md](SECRET-ISLAND.md) for gameplay, server permissions, save/retry behavior, data preservation, test boundaries and rollback.

## Clickable web links

Existing and new message bodies, photo captions, Keepsakes and search results automatically render HTTP/HTTPS URLs, `www` addresses and bare domains such as `example.com` as links. Bare domains use HTTPS; links open separately with `noopener noreferrer`. Link rendering escapes message HTML, excludes email/unsupported-scheme fragments, preserves surrounding punctuation and performs no preview downloads. Stored message text and all database records stay unchanged. `npm run test:links` verifies old/new messages in two isolated browsers and native phone taps to a controlled external destination.

## Our places

Opt-in location sharing uses browser GPS, private Supabase latest-point records and a separately enabled Leaflet/OpenStreetMap map. Each person chooses a duration, can pause or stop from any page, and sees accuracy and update time. GPS pauses when the website is hidden; continuous locked-screen/background tracking is unsupported. Reloading does not silently restart GPS. Only the additive `016_private_location_sharing.sql` migration is used. See [LOCATION-SHARING.md](LOCATION-SHARING.md) for official free-tier research, privacy, offline stopping, preservation, verification limits and rollback.

## The polished little world

The header now shows privacy-controlled Online/Last seen from existing activity timestamps; online can take roughly a minute to expire. Receipt transitions preserve bubbles, unread activity appears away from chat, replies keep drafts on cancellation, and photo preparation can be canceled safely. **Our little world** includes daily date ideas, unsent romantic note drafts, Firefly Trail and an optional pocket breathing pause. Existing garden/island games have clearer feedback, optional memory peeks and more consistent controls. New activities make no database requests. See [OVERHAUL.md](OVERHAUL.md) for the complete changes, preservation baseline, performance and verification limits. No database migration accompanies this release.
