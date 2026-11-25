# Correspondence redesign checklist

The original brief calls for a complete, production-grade visual transformation of this private chat for two. Every existing feature must keep working across phone, tablet and desktop. Message delivery must be reliable and use less data on very slow Wi-Fi.

- [x] Use Impeccable, Taste and Emil Kowalski's animation skill. Apply their guidance to hierarchy, a distinctive visual identity, purposeful feedback, responsive layout and reduced motion.
- [x] Use the requested primary palette. Pink `#FAC7E1` supplies stationery and outgoing messages, plum `#A5467C` supplies ink accents, and cobalt `#004AFD` identifies primary actions and the engraved lunar illustration.
- [x] Redesign the sign-in, invitation, sample and authenticated experience. Review both account themes, navigation, conversation, composer, dialogs, keepsakes, settings, places, island and garden. Preserve the couple's existing activities, special scenes, account rules, photos, messages and history.
- [x] Cover real waiting states. Include boot, session restoration, sign-in, initial chat, earlier history, secondary pages, upload progress and reconnect/retry. Keep the composer mounted when ancillary history data arrives.
- [x] Integrate press feedback, view transitions, send bounce, sheets, dialogs, menus, gestures, welcome and farewell scenes. Retain adaptive motion, the ambience control and system reduced-motion support.
- [x] Reduce transferred data and perceived delay. Project long first-send acknowledgements onto server timestamps and sequence fields. Keep stable UUIDs and full canonical rows on manual retry. Load related history data concurrently. Use 16-message pages on data-saving or reported 2G links and 50 elsewhere. Older history remains available.
- [x] Review layouts at 320, 390, 768 and 1440 CSS pixels. Exercise narrow navigation, keyboard focus, landscape composer behavior, themes, long messages, private sign-in and sample mode.
- [x] Compare the integrated release build with the prior production branch and check the 25,000-byte initial JS/CSS budget. Keep the SDK, games, maps and media lazy-loaded.
- [x] Check the original requirements after integrating all 11 commits newer than the initial workspace. Include the personalized transitions and latest send motion in the redesigned experience.
- [x] Finish the full regression pass and verify the Vercel preview revision. All 69 unit tests and 23 browser suites passed, including targeted reruns after fixes. The endurance run lasted 150 seconds. Initial JS and CSS total 21,901 bytes gzip, down from 24,452.

## Verification notes

Using the same test accounts and 150 seeded messages on the prior main revision (873ced1) and the redesign, the HTTP fixture modeled 700 ms round-trip delay, 2 KiB/s upload and 4 KiB/s download. Data Saver was enabled. Time from sign-in to visible history was 6.62 s before and 4.26 s after. For a 5.4 KB text, elapsed time from Send to HTTP acknowledgement was 4.98 s before and 3.70 s after. The acknowledgement payload fell from 5,616 bytes to 99 bytes. The benchmark covers application payloads and modeled delays. Actual radio conditions, server load, protocol overhead and physical-device timing vary.

Separate two-browser checks exercise delivery to the other account, retries after lost acknowledgements, editing, paging, media, location sharing, notifications, session refresh, accessibility and special scenes using synthetic data. Live private accounts were excluded from testing.
