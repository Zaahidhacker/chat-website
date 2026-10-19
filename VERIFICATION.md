# Verification — 19 October 2026

## Results

- Production dependency audit: **0 vulnerabilities**.
- Unit checks: **10 passed**.
- Two-browser integration scenarios: **18 passed**, with **0 browser page errors**.
- Actual Supabase transaction tests: **passed**, with all test accounts, invitations and messages rolled back.
- Initial JavaScript and CSS: **19.0 KiB gzip**, including static shared chunks. Messaging SDK is loaded on sign-in and cached.
- Cold login at **6× CPU throttling, 150 ms network latency, 1.6 Mbps**: **1164 ms**. Encoded resource bodies: **19440 bytes**, excluding HTTP headers.
- Phone optimistic send to painted bubble at **6× CPU throttling**, with a full 100-message phone window: **128 ms**. This measures local feedback, not delivery across the internet.
- History stress: 10,000-message state remains bounded; desktop renders at most 200 messages, phone at most 100.

## Browser scenarios

The real UI and Supabase JavaScript SDK run in two isolated browser contexts. Supabase HTTP and WebSocket traffic is served by an explicitly test-only local fixture because this workspace blocks direct network access to Supabase. This is **not a live Supabase transport test**.

- public login does not download the messaging SDK.
- two isolated sessions restore the correct partner and initial history.
- Zaahid sends → Layaana receives exactly one message.
- Layaana sends → Zaahid receives and read receipts update.
- saving and editing remain synchronized.
- reaction arrives without refetching message history.
- lost acknowledgement and manual retry create no duplicate.
- reconnect catches more than fifty missed messages and offline edits.
- presence and typing preserve existing message elements.
- scroll bursts do not flood receipt requests.
- history window stays capped at two hundred bubbles.
- receiving while reading old messages does not mark the new message read.
- personal clear leaves partner history and saved keepsakes intact.
- failed mobile send survives reload and retries exactly once.
- six-times CPU-throttled phone stays within a one-hundred-message window.
- six-times CPU-throttled phone sends and paints promptly.
- slow-network cold login paints without loading the messaging SDK.
- signout removes conversation and private outbox from the page.

## Actual backend checks

`tests/database.sql` was executed through the connected Supabase tool against project `jczsnrzqocstbpsgwkdy`. It passed both-direction message visibility, replies, author-only editing, stable-ID retries, personal clear isolation, saved-message retention, >100-message delta replay, delivery/read distinction, suppression of redundant receipt writes, nonmember denial and anonymous privilege checks.

The conversation is prelaunch: no real accounts or private messages were created or inspected by these tests. The fixture setup refuses to run after real members or messages exist.

Performance advisor: no remaining warnings for per-row auth evaluation; unused-index information is expected before everyday traffic. Security advisor: no anonymously executable chat RPCs. It still reports the intended authenticated security-definer operations for manual review, and the private invitations table intentionally has no client policy. Each privileged operation checks membership/ownership with a fixed search path.

## Limits and activation

Live Supabase Auth email delivery, real two-user WebSocket delivery, real-device battery behavior, and public Vercel-origin browser access have not been verified from this environment. The user chose to proceed with available tests after the workspace network restriction was identified. Native Vercel deployment status is checked separately after publication.

Set Supabase Authentication → URL Configuration → Site URL and allowed redirect URL to the final Vercel URL. Confirm email delivery to both approved addresses. Existing private invitation codes remain valid. Neither four-digit password was configured; each user must choose a password of at least 12 characters and verify their email.

No fixed delivery latency or zero-lag guarantee is possible across variable phones, networks, free-service cold starts or provider outages.
