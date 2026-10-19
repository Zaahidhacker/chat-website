# Free photo sharing and shared moon garden

Research checked 19 October 2026 against official provider documentation. The connected Supabase organization is Free and Vercel team is Hobby; no paid service, plan upgrade, billing change or external image/game API was added.

## Feasibility and limits

| Service | Published free limits relevant here | Design |
| --- | --- | --- |
| Supabase Storage | 1 GB storage; 5 GB uncached egress plus a separate 5 GB cached egress allowance; Free upload maximum 50 MB | Direct private uploads; our own limits are 512 KiB full JPEG + 32 KiB thumbnail, at most 1600 px. Authenticated private downloads should be budgeted against uncached egress, without assuming CDN savings. |
| Supabase database | 500 MB; Free projects can pause after a week of inactivity | Separate compact metadata and once-daily game records; no game polling. |
| Vercel Hobby | 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer and 1 million edge requests per month; function request/response body limit 4.5 MB | Static assets only. Photos bypass Vercel functions, so the function body limit does not apply. |
| GitHub | Normal repository file limit 100 MiB, with separate Actions allowances | Source only. Private photos, backups and credentials never enter Git. |

Supabase limits are organization/project allowances, not guarantees reserved for this app. Other usage in the organization counts too. Free is feasible for two people at modest usage, **not unlimited**. Actual quota exhaustion or provider policy changes can restrict availability. Check Storage and Egress usage in the Supabase dashboard; no automatic paid upgrade is configured.

The server pauses new reservations at **1,000 photos or 450,000,000 declared combined bytes**, whichever comes first. Even dishonest smaller declarations cannot exceed roughly 557 MB across the two immutable, size-limited objects per reservation. This leaves headroom under 1 GB, but does not replace organization-wide usage monitoring. Incomplete reservations count conservatively. No automatic history/photo cleanup runs when full; existing content stays in place. A failed full upload may leave a private pending thumbnail until retried. A sender can cancel the preview before reserving/uploading anything.

Sources:

- [Supabase pricing](https://supabase.com/pricing)
- [Storage upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Storage bandwidth](https://supabase.com/docs/guides/storage/serving/bandwidth) and [egress accounting](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Private bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [function limits](https://vercel.com/docs/functions/limitations)
- [GitHub large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)

## Private photo path

A small worker decodes supported JPEG, PNG, WebP and browser-supported HEIC/AVIF images. It resizes and compresses to JPEG, strips original metadata and creates a thumbnail. No paid image transformation is involved. Tiny or graphics-heavy source images are not guaranteed a smaller combined JPEG + thumbnail; the preview shows actual before/after bytes. Input is limited to 25 MB and decoded images to 40 megapixels; decoding memory depends on the browser.

A membership-checked RPC reserves an immutable UUID/path and quota. JWT-authenticated XHR uploads report progress directly to Storage. A separate commit RPC checks authoritative object metadata (sizes and JPEG MIME) before creating a **new** ordinary message through the existing send function. Stable UUIDs make retry safe after upload/commit acknowledgement loss. No historic message is modified. Browser validation decodes actual images; Storage validates size/MIME, not a deep server-side binary image scan.

Buckets are private. Storage reads rely on the photo row’s RLS and existing message visibility, including personal hide/clear and deletion. Unsent objects are visible only to their owner. No public URL or bearer signed download link is generated. Blob URLs stay in a bounded memory cache and are revoked on sign-out; the service worker never caches photo bytes or auth responses. Downloading a photo intentionally saves a copy on that user’s device. This is authenticated private storage, not end-to-end encryption.

## Game design and efficiency

The selected experiences give a useful solo visit without requiring a simultaneous partner: a shared pet/garden, reflective daily question, short memory-pair challenge and deduction puzzle. Activities grow the same gentle progression, with no streak penalty, timers pressuring play or intrusive prompts. Daily questions are original local content; no AI API is called.

Pet-and-care design inspiration: [Finch’s approach](https://finchcare.com/about-finch) and [self-care philosophy](https://help.finchcare.com/hc/en-us/articles/37935669335309-Our-Approach-to-Self-Care). No Finch assets, software or service are used. [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) governs pausing.

Separate lazy-loaded JavaScript/CSS, inline SVG, short user-triggered transforms and optional synthesized tones avoid game engines, animation packages, media downloads and continuous rendering. The garden has no polling or realtime subscription. Open, Refresh and completed actions fetch compact state. Each activity grants fixed points at most once per person/day in Asia/Colombo. Answers are sealed on the server until the viewing partner has answered that day; note writes are immutable. Recent shared notes load in a bounded list. Games never write to the conversation tables.

## Preservation and deployment

A fresh owner-authorized private backup captured 35 existing messages plus account identities and associated preferences/saved/reaction state before DDL. Its parsed SHA-256 was `4eec5187e9f0c31c21976a756b574530ae8426ea33b8e7096a06cc6e1d48ace8`. The backup is private workspace material, excluded from Git and Vercel. JSON equality against the live database verified all 35 baseline messages still present and exactly unchanged after migration. Original account IDs remain in place. No removal/restoration was necessary; restoring over newer user activity would be unsafe.

Only two new additive migrations were applied to the existing project. Existing clients can continue text messaging during rollout. Rolled-back database fixtures test the new functions and policies without changing old rows. Production remains on the existing GitHub-connected Vercel project and canonical URL.

## Test boundaries

`npm run test:features` uses real Chromium, real app code, real compression workers/IndexedDB and the real Supabase SDK against a controlled test-only Storage/Realtime/RPC transport. It verifies gallery/camera input configuration, preview cancellation, compression, recipient thumbnails, fullscreen zoom/download, photo swipe reply, anonymous denial, restart-safe retry, lost acknowledgements, sign-out cleanup, shared care/progression, sealed answers, once-daily rewards, local replay, moon surprise, no game polling, layouts from 320–1440 px in both themes and 6× CPU game responsiveness.

`tests/photo-garden-database.sql` ran against actual Supabase in a rollback transaction: reservation limits and ownership, unpublished photo privacy, commit metadata validation/idempotence, recipient visibility, personal hiding, outsider/anonymous denial, daily rewards and sealed answers. Storage fixtures here are metadata rows only; this does **not** prove actual object-byte upload/download through the live Storage HTTP service.

The workspace’s outbound policy blocks direct Supabase and Vercel browser origins. Live database policies and production static delivery are checked through native connectors. Physical camera capture, device pinch behavior, real authenticated Storage byte transfers and live two-device WebSocket delivery remain device-side verification steps. Existing live two-way text messaging was independently confirmed by the owner. Controlled timing results are not promises of zero lag on real internet connections.
