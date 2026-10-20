# A more thoughtful little universe

This release refines the existing application and adds complete, lightweight activities. It uses the existing GitHub, Vercel and Supabase projects. There are no new subscriptions, third-party APIs, production dependencies, database migrations or administrative writes to personal data.

## Design and navigation

The shared palette now uses warm midnight plum, soft rose and sage, with a corresponding cream/light theme. Navigation, cards, dialogs, composer, message bubbles, quote blocks, controls, empty states and focus indicators share consistent spacing and rounded geometry. Existing self-hosted fonts remain cached. Illustrations use local CSS and SVG; no remote illustrations, videos or animation libraries are downloaded.

Chat, photos, settings, Keepsakes, the garden, island and location views were reviewed. Secondary views, their styles, conversation rendering and action dialogs load when needed rather than adding everything to the public login. The original two-account access model remains authoritative.

## Messaging and presence

- **Online and last seen:** the header uses existing privacy-controlled server activity timestamps. Activity within approximately 65 seconds shows Online; older activity shows a relative or calendar last-seen time. The existing visible-tab heartbeat runs about every 30 seconds. This is an activity indicator, not exact background presence or proof the other person is watching the chat. Settings explains the possible delay. Turning off presence hides online, last seen and typing. A local UI clock updates labels without additional database queries.
- **Receipts:** a clock represents sending; one/two checks represent sent/delivered; read checks change accent with a short transition. Receipt updates and normal send acknowledgments preserve the message bubble. Server timestamps update separately. This also fixes an observed race during native touch swiping while an acknowledgment arrived.
- **Layout:** consecutive messages from the same person within five minutes group visually. Timestamped day markers remain, and the initial unread boundary is identified. An unobtrusive New marker and neutral browser-title dot indicate unread activity when away from the conversation. No message text enters the document title or notifications.
- **Interaction:** typing has a short-lived dot treatment. Older-history loading retains a keyed scroll anchor. Canceling a reply preserves the unsent draft; canceling an edit restores the prior draft. Emoji insertion respects the current selection. Lost acknowledgments that are already confirmed by realtime do not revert a text message to Failed.
- **Reliability:** transport requests have bounded response-header waits and honor caller abort signals. Only reads and already-idempotent chat operations receive one transport retry; Auth and non-idempotent mutations do not. Request-object methods are correctly respected. Existing stable UUIDs, revision replay, outboxes, tombstones, visibility rules and personal clear semantics remain unchanged.

## Our little world and new rituals

The former static About page is now a navigable home for little activities:

1. **A tiny plan for two:** eight complete date/connection ideas rotate locally, with a daily starting selection. Choosing an invitation opens an editable message draft; it never sends automatically. Changing the idea does not interrupt a running game.
2. **Thinking-of-you notes:** a small selection of ready-to-personalize notes is available beside the desktop composer and through Conversation options on phones. Choosing one appends to an existing draft rather than erasing it.
3. **Firefly Trail:** watch a short four-symbol trail, then repeat it by tapping or keys 1–4. Each successful round adds one light, up to twenty rounds. The daily trail is the same for both people. A personal best is stored per account on the current device; it is not represented as shared garden XP or an island reward. A score can be shared through an unsent chat draft. After assets load, gameplay needs no internet or database requests.
4. **A pocket pause:** an optional guided circle offers five gentle breathing rounds, with text instructions. There is no microphone, health tracking, account write or autoplay. The activity pauses when hidden and honors reduced motion.

Firefly timers are bounded and cleared on pause/unmount. There is no perpetual game loop or background polling. These activities remain separate from messaging and do not introduce push notifications, streak penalties or competitive leaderboards.

## Garden and island

Pip, shared garden growth, daily sealed questions, existing puzzles, island chapters, discoveries, cottage pieces and surprise notes keep their existing server data and reward rules. The garden adds clearer care feedback, pair/accuracy metrics, code-guess feedback and consistent card/control styling.

Island memory games offer one optional **gentle peek** per round; it does not award a completion or stars. Existing completion validation and duplicate reward protection remain. Keyboard focus stays on usable puzzle controls when a board changes. Falling-star score/combo/time labels update only when their displayed value changes, instead of rewriting the same text at the animation frame rate. Existing 30 Hz gameplay and hidden/unmounted pausing remain.

## Photos, locations, notifications and accessibility

Photo preparation can be canceled while its worker is loading or processing; cancellation settles the pending operation, and a late result cannot open a preview after closing it. Loading handlers are attached before image source assignment. Zoom/download are disabled until a full image is available. Compressed in-memory photo caches are bounded to six full images and 32 thumbnails; existing private buckets, compression limits, camera/gallery choices and account-scoped outbox stay intact. Text-only history avoids unrelated photo-metadata lookups.

Location cards preserve keyboard focus during freshness updates and skip identical markup. The already-verified opt-in/session/expiry controls, private latest-point storage, fresh-fix retries and separate map consent remain. A website still cannot provide continuous GPS while closed, hidden or locked; see [LOCATION-SHARING.md](LOCATION-SHARING.md).

Notification setup now cleans up service-worker state listeners on completion or timeout. Existing explicit permission requests, generic private notification text, account gating and device opt-out remain. Actual push delivery depends on browser/OS support and was not proven by a stubbed notification display test.

Dialogs make the underlying application inert and restore focus to the opening control on close. Focus outlines, small-screen layouts and reduced-motion behavior were checked. Background CSS animation pauses explicitly, the online dot is steady, and receipt/dialog effects are short rather than continuous. New game feedback is textual as well as visual. These checks do not constitute a complete screen-reader or WCAG certification.

## Preservation and rollback

A fresh private workspace snapshot was verified before implementation: **989 messages, nine photo records, eighteen storage-object metadata records, two account identities, two member name/slot bindings, two preferences, two favorites, six reactions, seven garden events, one garden answer, eighteen island completions, wallet, inventory, placement and surprise-note records**. Hash: `524f69707d22e63b3cef400475adf5bd163ff14f81b26441deb8ee8b04a4abed`.

The snapshot and comparison SQL are excluded from GitHub and deployment. The snapshot covers database rows and object metadata; original photo bytes were not exported and existing storage objects were never modified. Location coordinates and notification secrets were not copied for this frontend-only release. A live read-only comparison found every baseline message/photo/game record, account identity, member binding, preference, favorite and reaction unchanged. Automatic member activity counters and storage access times are intentionally excluded from identity/object comparisons. No restore, reset or history rewrite was needed.

Known-good prior release: commit `7a0fcc15f9a090d81dce6011dc0e2397afd761ba`, deployment `dpl_BxJ6wjfPwHezD97T1oizazTC3i4M`. Frontend rollback leaves all database/storage data in place. Do not reset production, regenerate invitations or replace old snapshots over legitimate user activity.

## Verification and limits

The build enforces **25,000 bytes gzip** for initial JavaScript and CSS; this release uses **24,923 bytes**. Fonts and optional feature assets load separately and are cached. No purchased service is needed, but shared Supabase/Vercel/GitHub free quotas and OpenStreetMap fair-use/availability policies still apply.

The full checks include unit tests and the messaging, upgrade, photo/garden, island, clickable-link, location and new-overhaul browser suites. New checks cover presence privacy/expiry, receipt node preservation, unseen activity off-chat, draft safety, dialog focus, daily invitations, offline Firefly play, per-device best scores, hidden activity pausing, 320–1440 pixel themes, photo preparation cancellation and optional memory peeks without extra rewards. Existing tests cover two isolated account contexts, reconnects, lost responses, slow networks, 6× CPU throttling, Storage access denial, private service-worker handlers and location permission/consent failures.

Browser tests use actual UI code and the Supabase SDK with a labeled controlled transport, not real private conversations. Runtime network policy blocks direct production-origin authenticated browser traffic. Native connectors verify production data preservation and deployment assets. Real iPhone Safari, physical GPS accuracy, actual battery drain, real two-phone internet delivery and provider push delivery still require device checks. Controlled timing figures are local measurements, not promises of real-network latency.
