# Our Little Universe

A private, text-first chat for Zaahid and Layaana. Built with vanilla JavaScript, a lazy-loaded Supabase client, Supabase Auth and Postgres row-level security. The production host is Vercel, with source in `Zaahidhacker/chat-website`.

## Develop and verify

```sh
npm ci
npm test
npm run build
npm start
# Once on a development machine:
npx playwright install --with-deps chromium
npm run test:browser
```

The build enforces a 25 KB gzip budget for initial JavaScript plus CSS. Assets have content hashes and long-lived cache headers. Only the public application shell is cached; auth and message responses are never stored by the service worker.

## Messaging and efficiency

- Immediate local message feedback, stable UUID retries, authoritative server order and timestamps.
- PostgreSQL change subscriptions, with revision-based replay on reconnect; edits and tombstones also replay.
- Fifty-message history pages, at most 100 rendered bubbles on phones and 200 on laptops. Older history remains available through paging.
- Keyed message elements: unchanged bubbles stay in place; presence, typing and read receipts update separately.
- Coalesced receipt requests, no unchanged database receipt writes, and one visible-tab presence heartbeat every 30 seconds.
- After 30 seconds in the background, the socket closes. Returning reconnects and fetches changes. If realtime is unavailable, the visible tab checks for changes every 30 seconds.
- Drafts and failed sends survive reload within the same tab. Closing a tab may discard them. Sign-out clears private in-memory state and session outboxes.
- No external fonts, images, analytics, autoplay, media sharing or push notifications.

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

The execution workspace blocks direct Supabase API and Vercel-origin network access. Live account activation and authenticated Supabase WebSocket delivery have therefore **not** been verified. The test fixture's timings are not real internet round-trip measurements. See `VERIFICATION.md` for recorded results.

## Deployment and budget

`vercel.json` builds the static `dist` output. The GitHub workflow runs unit checks, the budgeted build and browser integration tests without account secrets. Deployments use Vercel's GitHub connection; no service-role key is present in the browser.

The connected Vercel team uses **Hobby**, and the Supabase organization was verified on **Free**. Free quotas, inactivity pausing, GitHub Actions allowances and provider policies still apply. No purchased domain, paid API, storage plan or billing integration is used.
