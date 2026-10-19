# Design notes

Applied the installed [Taste Skill](https://github.com/Leonxlnx/taste-skill), `design-taste-frontend`, to the existing vanilla JavaScript app. Direction: True-black flat, seed 818662657; no redraws. Kept the romantic rose identity and chose self-hosted Manrope for the interface and Cormorant Garamond for the wordmark and editorial moments. No framework migration.

The screen's question is “What did my person say, and how can I reply?” The conversation stays dominant, the composer stays within reach, and menu controls remain secondary. In settings, the question is “What does this choice share or change on this device?” Notification copy explains the exact generic preview and platform limits.

The face is warm near-black with rose-tinted outgoing words and a separate muted teal identity for the partner. The signature interaction is a right swipe that pulls a specific message into a reply preview. It shares the existing accessible reply action and stored reply identifier. A closed mobile drawer casts no shadow; the original screen-sized shadow was the dark-cover defect.

The design inspector moved from five failures to zero on login and chat at desktop/tablet/phone widths. The chat run allows emoji because conversations, reactions and read receipt marks must remain intact. Static lint likewise reports those existing glyphs and two sentence-case section labels; changing user content or removing receipts would violate the brief. Ivory foreground and the login's larger editorial headline are intentional exceptions to the inspector's generic app warnings.

ROUND 2
Seen in one second: a private conversation, with the partner named and a clear place to reply.
Idea: the two people remain the only identities in a quiet, warm conversation space.
Live thing: swipe an actual message into the existing reply composer.
Layout: desktop navigation and conversation; phone header, independent scrolling log, pinned composer; settings in a single readable column.
Scores (subjective visual review): design 7.5 · usability 8.5 · creativity 6.8 · content 8.0 → overall 7.8.
Caps: no marketing-page imagery or motion floor applies to this app screen.
Resolved issues: the closed drawer shadow, four-line tablet login heading, and touch capture transfer interrupting a swipe.
Remaining limits: the visual language deliberately stays familiar to chat apps; physical Safari and Android rendering need device access for final comparison.

The sample universe uses the original fictional five-message conversation and is explicitly labeled. Authenticated chat continues to use only the existing database's real data. There are no invented testimonials, statistics, third-party photographs or image assets to replace. The two fonts use their bundled SIL Open Font License, shipped with the public build.
