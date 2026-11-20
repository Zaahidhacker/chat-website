# Android interaction and motion implementation

This upgrade preserves the November 4 resting design at checkpoint `974ffe8`: message content, fonts, typography, colors, backgrounds, icons, bubble alignment and spacing. No schema, authentication, RLS, storage or message-persistence changes are involved. Implementation started on `motion/android-fluid`; the unrelated existing `.codex/config.toml` edit is excluded.

## Stack and guidance

The frontend is vanilla JavaScript/ES modules, not React. Motion 14.6.0 and the official Motion AI Kit `/motion` skill were already installed; no installer or additional production library was necessary. The skill's vanilla-JS, tool-selection, compositing, interruption and reduced-motion guidance was applied. Its MCP tools are not exposed in this session, so this implementation uses public browser APIs rather than gated examples or paid performance tools. Vercel's Web Interface Guidelines were reviewed; React-specific profiling/checklists do not apply.

References: [Motion AI Kit installation](https://motion.dev/docs/ai-kit-install), [Chrome viewport behavior](https://developer.chrome.com/blog/viewport-resize-behavior), [CloseWatcher proposal](https://github.com/WICG/close-watcher), [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).

## One viewport strategy

The viewport uses `interactive-widget=resizes-visual`: Chrome keeps the layout viewport stable while the visible viewport follows the keyboard. `chat-viewport.js` is the sole viewport-size writer: VisualViewport supplies the visible height and offset, with innerHeight as the fallback. The keyboard height is never subtracted a second time. Resize/scroll signals coalesce into one requestAnimationFrame update; there is no timed imitation of the OS keyboard. Pinch zoom stays under browser control. Zero/invalid intermediate heights are ignored. Focus changes sample actual viewport geometry for at most 600ms to catch delayed or coalesced browser events; no predicted keyboard height or timed keyboard tween is used. Only changed geometry writes styles, and sampling stops while idle. Browser-driven scroll adjustments during a viewport resize retain the cached reading intent.

A post-layout ResizeObserver restores either the bottom or a cached reading anchor when the message area changes size. Explicit “latest” operations update the anchoring intent; initial binding waits for the app's first scroll. Old-history positions use the message/log key if a node was replaced. Scroll snapshots use binary search through the bounded log, with batched reads. There is no blanket smooth-scroll on every new message. The viewport and log observers release account/message references on sign-out. Reduced motion disables effects while retaining functional viewport positioning, including nonzero browser-panning offsets.

`composer-layout.js` measures a typography-matched, invisible mirror in a closed shadow root. Editing writes text; ResizeObserver provides dimensions, and queued writes resize the input without repeatedly setting height:auto and reading scrollHeight on each keystroke. Selection/value stay on the real textarea. The only size tween is a short, bounded 120ms textarea growth transition; this necessarily performs layout, so it is restricted to the small composer. It is disabled during viewport movement and reduced motion. Keyboard-driven height changes themselves are never tweened. Existing safe-area and compact-height CSS remain in force.

## Shared motion

`motion-system.js`, `motion-physics.js`, `motion-tokens.css` and `native-motion.css` provide short timing roles, a shared easing curve, cancellation, sampled damped springs, enter/exit utilities and reduced-motion/background cleanup. Motion runs through native WAAPI/CSS; springs are sampled once at release, not integrated by a permanent frame loop. Natural release velocity is bounded; spring tails converge before returning to an exact resting transform.

New incoming/outgoing messages receive small directional translations at full opacity, with no font scaling and no historical-list replay. Receipt updates retain the existing message elements. Swipe-to-reply tracks the finger through a single queued write per frame, adds resistance, and springs back from the release velocity. Touch cancellation and vertical scrolling cancel correctly. Re-grabbing a settling bubble starts at its current position. Long-press opens the existing action menu; message actions remain reachable by their existing button and keyboard paths.

Control feedback moves icons rather than scaling message text. Send readiness responds only to empty/nonempty state changes. Drawer transitions retarget natively; page transitions apply only to explicit navigation outside chat. Dialog cleanup/focus restoration happens immediately, while a brief aria-hidden, inert visual exit layer dissolves; IDs and action attributes are removed from the exit layer, it is excluded from keyboard queries and removed on completion, reduced motion, backgrounding or sign-out. Tests scope active dialog queries to `#modal-root` so an inert outgoing visual layer is not mistaken for a live form. CloseWatcher is feature-detected for native close requests on supported Chrome; unsupported browsers retain explicit close and Escape controls without synthetic history entries.

Photo preview/view entry and zoom reuse the same timing/interruption rules. Photo zoom scales only the image, never typography, and makes its final actual size available for panning. Downloads, private storage and compression remain unchanged. Existing heart, garden, island and anniversary scenes retain their authored timelines, assets and pause behavior. The relationship counter acknowledges an actual day change, without an initial historical replay or additional polling. Login, switches, toasts, reply previews and typing states share the motion language. No font, color or layout redesign is included.

## Verification and limits

`npm run test:motion` exercises progressive synthetic VisualViewport changes, toolbar-like offsets, bottom and old-history anchoring, pinch-zoom ownership, rapid/multiline typing and cursor retention, simultaneous incoming messages, long-press cancellation, dialog interruption/cleanup, native CloseWatcher requests, reduced motion, and settled-style comparison against the baseline fixture. It records actual frame intervals and supported Long Animation Frame observations. Unit tests cover finite/convergent physics and extreme velocity bounds.

The existing integration suites continue to cover touch swipe, history pagination, two-client text delivery, retries, reconnection, photos, zoom/download, voice notes, presence, games, anniversary resume, accessibility, compact keyboards and landscape layouts. Tests use isolated synthetic accounts and deterministic transport; they never send messages or mutate personal production records.

The available browser is Debian Chromium 154.0.8037.57, with Node 24.19.0 and Playwright 1.62.1. Representative portrait widths include 360, 393, 412 and nearby sizes, plus landscape/tablet/desktop coverage. These CSS sizes are test cases, not model detection. The user identifies the second phone as probably a Xiaomi 12 Pro; the exact model, Chrome version and keyboard remain unconfirmed.

**Physical devices were not attached.** Actual Gboard/SwiftKey/other IME animation, OEM display scaling, toolbar/panning, gesture-navigation integration, display cutouts and sustained thermal/battery behavior on Pixel 7 Pro and Xiaomi are unverified. Native CloseWatcher requests were tested at API level, not by pressing a physical Android Back button. Headless frame diagnostics do not prove 60 or 120fps on those phones. The implementation has no fixed frame-rate cap; WAAPI/CSS can follow the display/browser refresh rate, but actual 120Hz operation requires device verification.

A useful physical check is a Performance trace through Chrome remote debugging: record keyboard open/close, rapid multiline typing with simultaneous incoming messages, scrollback, swipe cancellation, photo zoom, orientation change and Back. Check dropped frames/long animation frames and caret/composer visibility at both default and enlarged Android display scaling, with battery saver both on and off. No claim of physical-device parity is made from emulation.

## Local verification results

The local unit suite passes 65 tests, including spring convergence and velocity bounds. The motion browser suite passes ten checks. One 90-frame sample measured p50 16.6ms, p95 17.1ms and maximum 17.8ms, with no observed Long Animation Frames. These measurements are specific to this headless machine. The settled-style fixture preserves exact typography/color/spacing values; geometry allows half a CSS pixel for browser-version rounding. Initial JS/CSS remains below the unchanged 25,000-byte gzip budget (approximately 23.2 KiB).

The photo zoom test now waits for the actual animated size before asserting it; its privacy, transfer-count, download and reply assertions remain. Active-dialog tests query `#modal-root` rather than mistaking an inert outgoing visual layer for a live search result. The existing three-hearts suite caught an early-scroll/composer-growth race: the viewport now recognizes a reader's changed position even before the scroll event arrives, rather than retaining a stale bottom pin. Its original exact scroll-preservation assertion passes unchanged. The hosted verification workflow includes the new motion suite. Detailed local timing and sustained-session reports stay in ignored `work/native-motion/` and `work/`.

## Premium motion, phase 2 (November 20, 2026)

Phase 1 added a boot splash, send pulse, message entrances for the latest three
messages, chat skeletons and pending fades. Phase 2 keeps every resting style
unchanged and works inside the same constraints:

- **Budget discipline.** The phase 1 rules that only ever render after sign-in
  (pending fade, skeletons, day/unread/jump/nav-unread entrances) moved out of
  the initial `motion-tokens.css` into the lazy interactions bundle
  (`native-motion.css`, loaded before the first signed-in render). The cold
  login therefore pays nothing for chat motion. New JS lives in lazy modules
  (`motion-system.js`, `composer-layout.js`); the only initial-JS change is a
  three-line cascade counter in `app.js`. Initial JS+CSS is ~23.6 KiB gzip,
  still under the 25,000-byte budget.
- **Send continuity.** New messages cascade in with a 30 ms stagger (latest
  three only, 180 ms each, so the last one settles by 240 ms). The send icon
  now rotates and grows slightly as the composer gains text, and the round
  send button fills with the accent colour only while there is something to
  send — the empty-composer resting style is untouched.
- **Typing and receipts.** The typing dots now bounce as well as fade, on the
  existing stagger. The sending receipt's clock spins while a message is in
  flight; delivered/read ticks keep their existing arrive/bloom motion.
- **Reactions, failures, photos.** Reactions pop in on a 140 ms scale when a
  reaction appears; a failed message gives one small 2 px nudge; photo frames
  fade/scale in over the panel duration.
- **Screens.** Secondary pages (keepsakes, settings, about) and the welcome
  moment fade up on entry; their cards follow. The boot splash staggers its
  title, shimmer bar and caption. All of it is transform/opacity only, settles
  within 260 ms, and is disabled under `prefers-reduced-motion`.
- **First-paint ordering.** The skeleton render in `enter()` happens only
  after `applyMetadata` and `restoreOutbox`, so the first paint already has
  the partner's name and any restored draft — the header never flashes "Your
  person" and the composer never flashes empty. Two browser suites caught
  early versions of this ordering; both now pass.

Local verification (November 20, 2026, headless Chromium): unit suite 69/69;
`test:browser` 18/18; `test:taste` 7/7; interactions, design, replies,
overhaul, foreground and robustness suites all pass. `test:motion` passes 8
of 10 checks; the settled-style check fails only on `#partner-name` width
(71 px baseline vs 72 px live) — the same failure occurs on the unmodified
`b532ef4` checkout in this headless-shell build, so it is a font-metrics
difference in the test browser, not a regression.

## Chrome guidance follow-up (November 13, 2026)

Installed and verified `modern-web-guidance@googlechrome` 1.0.0 in the Codex environment, and applied its `motion` guide alongside the existing Motion skill. Research used Chrome's viewport and VirtualKeyboard documentation and its compositor-animation guidance. Browser geometry can arrive in a single step; the website cannot force the Android IME itself to slide or guarantee synchronized per-frame OS insets. Physical-device verification remains necessary.

Control feedback now covers buttons across app pages, dialogs and photo controls, keyboard focus and fine-pointer hover. Spatial effects opt in under no-preference; passive text stays still and touch does not acquire hover loops. Existing fonts, resting styles, persistence and backend remain unchanged.
