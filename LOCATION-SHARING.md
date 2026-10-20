# Our places — 20 October 2026

Open **Our places** in navigation. Each person can independently choose **Start sharing my location**, select 15 minutes, one hour or eight hours, and grant their browser's location permission. Viewing the partner's shared point does not require sharing your own. Opening the page never requests GPS permission. Opening the map is a separate choice.

## Feasibility and free-tier research

This implementation needs no API key, billing account, subscription, geocoding service or paid map SDK. Browser Geolocation supplies device fixes, self-hosted Leaflet 1.9.4 draws the map, OpenStreetMap supplies ordinary map tiles, and the existing Supabase project carries authenticated updates. Vercel serves static assets; coordinates go directly to Supabase rather than through Vercel functions.

Official sources checked before implementation:

| Source | Finding and implementation consequence |
| --- | --- |
| [Supabase pricing](https://supabase.com/pricing) | Free includes 500 MB database size, 5 GB egress, two million Realtime messages per month and 200 peak Realtime connections. These allowances are shared with the existing chat and photos. This is feasible for two people, not an unlimited service. |
| [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) | Authorized table changes can use the existing authenticated SDK and RLS. No location polling or separate paid service is required. |
| [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/) | Standard tiles support modest interactive use without billing, subject to policy, capacity and availability. Required attribution, correct HTTPS tile URL, normal browser caching and a real Referer are provided. No bulk downloads, prefetching, offline tile packs or automated tile scraping. There is no SLA; tiles can be unavailable or blocked. |
| [Leaflet](https://leafletjs.com/) and [tile-layer reference](https://leafletjs.com/reference.html#tilelayer-referrerpolicy) | Lightweight open-source interactive maps, bundled locally and loaded on demand. Tile requests explicitly send an origin-only cross-site Referer while the rest of the site retains its no-referrer policy. |
| [W3C Geolocation specification](https://www.w3.org/TR/geolocation/) | Position updates require a fully active, visible document. This browser API cannot promise continuous background or locked-screen tracking. |
| [MDN watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition) | Requires HTTPS, permission and an allowing Permissions-Policy. Accuracy, GPS availability and permission behavior depend on the browser/device. |

No provider plan or billing setting was upgraded. Check the Supabase usage dashboard periodically. At the normal moving ceiling, two continuously moving users produce at most 720 coordinate writes per hour combined; stationary sharing normally produces at most 120 per hour combined. Realtime charges count delivered messages rather than database rows, and every subscribed device consumes an allowance. Map image traffic can exceed coordinate traffic, especially while panning. Neither GPS callback frequency nor actual battery consumption is under full website control.

## Background and compatibility limits

Android and iPhone browsers can share while this HTTPS page is visible and permission is granted. Desktop fixes may be substantially less accurate. **Switching apps, minimizing, or locking the phone pauses tracking.** The app clears its watch when hidden and resumes only the same unexpired, still-consented session when visible again. Reloading or reopening does not silently restart GPS: choose Start again. A Home Screen installation does not supply native background location permission, and service workers cannot access Geolocation. No wake locks or background-tracking workarounds are used.

OS battery management, browser suspension, poor GPS reception and provider outages remain possible. Pins represent reported fixes; the accuracy circle and update time disclose uncertainty. Animating a short move does not predict a person's actual position between samples. “Sharing · updated recently” describes a recent server sample, not proof the other phone is currently tracking. Stale, paused, disconnected and offline states show last-known details rather than claiming live movement.

## Consent, privacy and retention

- Sharing starts off. Browser permission follows an explicit Start action, and map tiles follow a separate Open map action. Precise GPS is optional and carries a battery-use explanation.
- **Pause** stops GPS immediately on the current device and preserves the timestamped last point. **Stop sharing** immediately stops local GPS and clears the shared coordinates on server acknowledgment. These controls remain accessible above chat and game pages.
- Offline stopping persists only an account-scoped pending-removal boolean, never coordinates. Removal retries on reconnection or the next signed-in visit. Until acknowledgment or expiry, the partner can still see the previous point; the interface explains this. A disconnected website cannot instantly erase a server record.
- Only authenticated database members can read shared points. Membership is bound to the existing two accounts; arbitrary Auth users and anonymous clients are denied. Direct client inserts/updates/deletes are revoked. RPCs derive ownership from `auth.uid()`, validate fresh fixes and lock each account against overlapping controls/late writes. A new session invalidates previous device nonces; Stop prevents late callbacks from restoring coordinates.
- There is one latest-point row per account, no route history and no location messages. Expiry blocks partner reads and hides the marker. An expired latest point remains accessible to its owner/admin until Stop or a new Start clears it; expiry is not physical database erasure. Stop clears coordinates, accuracy and sample timestamps, retaining only a coordinate-free control tombstone. Standard provider backups/operational retention may still apply.
- Coordinates are not written to localStorage, IndexedDB, the service worker or a durable offline upload queue. They exist in current-page memory and private Supabase storage. This feature is protected by HTTPS and account permissions, **not end-to-end encryption**; service administrators can access the database.
- The optional map provider receives the device IP, site origin and requested tile area, from which the approximate viewed area can be inferred. No names or coordinate RPC payloads are sent to it. Viewing coordinates without opening the map avoids those tile requests.

## Data and battery controls

Balanced positioning is the default. Moving fixes are coalesced to at most one publication per ten seconds, uncertainty-aware movement detection suppresses GPS jitter, and stationary updates use a fresh fix at most once per minute. The server independently enforces a ten-second floor within an active sharing session. It is not a malicious-client global quota: starting a fresh session can reset the floor. Old fixes are rejected; offline coordinates are never queued and replayed later.

The map and its JavaScript load only on map consent. Normal cached raster tiles use no retina multiplication, no outside-viewport buffer and no zoom prefetching. When coordinates are already available, the initial viewport fits them before adding tiles, avoiding an unnecessary world-map download. Identical coordinates skip marker/circle redraws; paused or stale markers have a dashed, muted appearance. Cards show relative age, calendar date/time, accuracy and consent expiry.

Location subscriptions exist while the location page is visible or this foreground page is actively sharing. Retaining the small subscription during foreground chat lets another device's Stop or session takeover promptly stop this device's GPS watch too. Returning or reconnecting fetches a snapshot and reconciles its authoritative session. The five-second age timer is local and makes no database requests. GPS sharing can continue through internal chat/game navigation while the website remains visible. Hidden maps, interpolation frames, location subscriptions and GPS watches stop. Reduced-motion settings disable marker interpolation.

Temporary connection failures retry only while visible, online and still opted in, with delays of 5, 15, 30 and then at most one attempt per 60 seconds. Only fresh fixes are sent after recovery. Failed Stop requests use the same bounded recovery, without restarting GPS; concurrent removal attempts are coalesced. Stop, manual Pause, permission denial and session expiry cancel sharing recovery. Temporary GPS unavailability/timeouts keep the existing browser watch rather than terminating it after a short grace period; limited fresh-fix attempts can recover without manual interaction. Revoked permission pauses and requires an explicit user action. Snapshot reads and control requests have abort timeouts. These are failure recovery attempts, not periodic location polling during healthy use.

## Safe migration and preservation

Only `supabase/016_private_location_sharing.sql` was applied. It creates a separate table, private implementation schema, member-checked functions, RLS policy and publication entry. It does not update or delete any existing message, photo, account or game table. Never reset production or rerun initial migrations.

Before migration, a private, verified workspace snapshot captured 926 messages, seven photo records and their storage metadata, two account identities, member bindings, preferences, reactions, favorites/hidden records, seven garden events, one garden answer and existing island progress. SHA-256: `12964cf24959f355348850ae11d845572ebfae5d14619b8c3168587b8870cd0d`. Photo file bytes were not exported; their existing objects were never modified. The snapshot and comparison SQL are ignored by Git and excluded from deployment.

Live comparisons found all baseline messages, photos, garden activities/answer, island completions, inventory, placements and wallet unchanged. During development an existing surprise note changed only its `opened` flag through normal use; its content stayed unchanged. That activity is preserved, never overwritten by restoring an older snapshot. Existing records stayed in place throughout the upgrade.

## Verification and honest boundaries

`tests/location-database.sql` ran against the actual Supabase database in a rolled-back transaction. It refuses to create fixtures if real location rows exist, checks consent/session expiry, fresh coordinates, write throttling, account isolation, outsider/anonymous denial, direct-write denial, paused reads, stopped tombstones and rejection of old session writes. It does not write old conversation/game tables. Supabase security advisors found no new location security findings.

`npm run test:location` uses real Chromium Geolocation with emulated coordinates and the actual Leaflet SDK. A labeled two-account Supabase transport and synthetic map tiles keep private data and external tile traffic out of browser tests. Checks cover default-off consent, independent opt-in, marker/accuracy display, origin-only tile Referer, movement coalescing, GPS cleanup on pause/stop, hidden/visible transitions, offline removal, cancellation during pending Start, expiry, messaging while sharing, 320–1440 pixel layouts, reload without automatic GPS, absence of location polling, native permission denial and sign-out cleanup. The transport supports concurrent realtime channels, matching the SDK's chat/location multiplexing.

The follow-up reliability pass adds temporary GPS errors, RPC outage recovery without a browser `online` event, automatic failed-removal recovery, Stop canceling a scheduled retry, another device taking over while the old device is in chat, hiding during a delayed Resume, server-throttled movement retries, stale-marker appearance and an idle-map/6× CPU check. It makes no schema or stored-personal-data changes. The headless fixture intentionally simulates transport failures; it does not prove real carrier-network behavior or physical battery savings.

These tests do **not** measure physical GPS accuracy, actual battery drain, iPhone Safari behavior or live two-device internet delivery. The workspace's network policy blocks direct authenticated browser traffic to production Supabase/Vercel. Backend SQL and deployed assets are checked through native connectors. The hosted migration connector was used after the environment's Supabase CLI bootstrap failed. Neither limitation was bypassed.

Before relying on it while travelling, each person should try Start on their phone, walk a short distance with the page visible, check the partner's timestamp/accuracy, then try Pause, Stop, screen lock and returning. Location sharing is best effort and is not an emergency tracking service.

## Deployment and rollback

Deploy from `main` in the existing GitHub repository through Vercel. The required Permissions-Policy is `geolocation=(self)` and CSP permits image tiles only from `https://tile.openstreetmap.org` in addition to existing image sources. No service-role credentials are bundled.

Previous known-good deployment: `dpl_4ocvzPAfRauzjuUp2zjWjQLcwUk3`, commit `778b75816f01d8278d6840870b5a550333d0c92b`. Rolling back the frontend to that deployment leaves the additive location schema safely unused and never rewrites old data. Stop sharing before a planned rollback, since the old interface has no location controls; any remaining location session expires independently. Do not drop tables as part of a frontend rollback.
