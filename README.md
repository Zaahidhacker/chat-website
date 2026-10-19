# Our Little Universe
A private, text-first messaging app for exactly two invited accounts. Vanilla JavaScript, a bundled Supabase client, Postgres row security, and Supabase Auth. Hosted privately with Sites; no paid integrations were added.

## Build
`npm ci && npm run build`. Run `npm test` for message-state checks. `tests/database.sql` tests two-user isolation, independent clearing, saved keepsakes and idempotent sending inside a rolled-back transaction. Browser checks are documented in the handoff.

## Enrollment
Only administrator-approved addresses with the matching invitation can register. Use **First time here? Set your password**, supply your invitation code, choose a password of at least 12 characters and verify your email. Return to the site to sign in. The account signup is provided directly by Supabase Auth; no service-role credentials are present in the app. Supabase's email confirmation redirect may need its Site URL configured to the deployed URL; verification still takes effect before the final redirect.

## Privacy
Messages are protected by HTTPS, authentication and row security; they are not end-to-end encrypted. Clear Chat stores a per-account sequence boundary and never globally deletes messages. Keepsakes survive clearing. Hide removes a message only for that account. An author can replace their message for both accounts with a tombstone. No media, push notifications or analytics. A service worker caches only public application files. Private messages stay in memory; signing out clears them. Unsent messages are retained in memory for retry, but will be lost on reload or closing the tab.

## Free tier
Connected Supabase organization was verified as `free`. Free quotas, inactivity pausing, email limits and platform policies apply; permanent free availability cannot be guaranteed. There is no paid API, billing integration or purchased domain. Text-only traffic, 50-message history pages, event subscriptions, and a 30-second visible-tab presence heartbeat limit data use. If Realtime is unavailable, the visible tab checks for new messages every 30 seconds.

## Later
Media sharing, push notifications, relationship counters and birthday automation are deliberately outside this release. Multi-device clear is respected on refocus and reconnect. Notification permission is never requested.
