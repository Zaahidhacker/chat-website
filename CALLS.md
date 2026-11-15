# Voice calls and notifications

Settings → **Manage phone notifications** requests permission directly from the click, before network/code-loading waits. Its persistent dialog reports blocked, dismissed, unsupported and enabled states. Opening enabled settings repairs the server registration; disabling is explicit. The test button sends a silent local notification to check OS display settings. Browsers cannot reopen an Allow prompt after permission was blocked; change the site's permission in browser settings first. On iPhone/iPad, install the site on the Home Screen and open it there (iOS/iPadOS 16.4+).

The conversation's phone button starts a voice call. **The caller hears no ringtone. The recipient hears the incoming ringtone.** A visible recipient page acknowledges the invitation and the caller sees **Ringing**; otherwise they see **Calling**. Acknowledgements expire after 25 seconds without refresh. This indicates page availability, not proof a human heard it. Microphone access starts only on Start or Accept. Accept, Decline, Cancel/End, mute, duration and minimized controls work across navigation. Autoplay rules may require a tap on **Enable incoming ringtone** after opening the site. Blocked remote audio offers **Hear call**.

WebRTC carries audio; Supabase stores call state and connection signaling. Every write checks membership, participant identity, device ownership, valid transitions and expiry. Transaction locks prevent overlapping calls and competing answers. SDP is erased on termination, finished rows after a day, and ICE candidates after two minutes. This feature does not record audio. A dedicated call subscription survives the chat's 30-second background pause. Active calls refresh a 90-second lease; invitations expire in 60 seconds. Audio setup times out after 25 seconds.

Sleeping/background pages receive invitations through the existing authenticated push webhook. The function looks up the authoritative recipient, targets only their subscriptions, sets a maximum 60-second TTL and deduplicates deliveries. Notification clicks focus/open the app without auto-answering. Accepted/ended calls dismiss notifications. The worker remembers 20 finished invitations to prevent late pushes from resurrecting them. Payloads contain IDs and expiry, without names, SDP or message text. The caller receives no call notification.

Incoming pushes request the OS notification sound (`silent: false`). A website cannot provide a continuous native ringtone from a suspended service worker or override Do Not Disturb, muted notifications, force-stop, battery restrictions or denied permissions. Active pages use the in-page ringtone after browser audio permission. Physical Android/iPhone delivery and hardware sound still need device testing.

## Remaining production relay setup

No production TURN provider exists in this project. Calls currently use STUN; some carriers, symmetric NATs, corporate Wi-Fi and UDP-blocked networks require TURN. The user chose to finish the feature and document this remaining setup. No paid service or public shared relay was added.

For a TURN REST compatible provider or coturn server:

1. Enable authenticated TURN over UDP/TCP and preferably TLS on port 443, using TURN REST/shared-secret mode. Ordinary static username/password credentials need a different adapter.
2. Save the shared secret directly in **Supabase Vault** as `universe_turn_shared_secret`. Never put it in client code, source or chat.
3. In Supabase SQL, substitute the real server's URLs:

```sql
insert into universe_private.call_config(id,turn_urls,turn_secret)
select true,
 array['turn:YOUR_TURN_HOST:3478?transport=udp',
       'turn:YOUR_TURN_HOST:3478?transport=tcp',
       'turns:YOUR_TURN_HOST:443?transport=tcp'],
 id from vault.secrets where name='universe_turn_shared_secret'
on conflict(id) do update
set turn_urls=excluded.turn_urls,turn_secret=excluded.turn_secret;
```

`universe_call_ice` returns membership-checked, one-hour credentials signed using the Vault secret. The shared secret never reaches the browser. Providers with their own credential-generation API need an adapter. Verify TURN/TCP/TLS and make a real call between the two phones on different networks before treating cross-network calling as fully verified.

## Verification and release

`npm run test:notifications` covers synchronous permission requests, registration repair, explicit disabling, blocked/dismissed prompts, retries and installation guidance in the real UI with a controlled browser notification API.

`npm run test:calls` uses real WebRTC with synthetic microphones and controlled authenticated signaling. It covers incoming-only ringtone playback, two-way media, competing answers, mute/end, Calling/Ringing, cancellations, expiry, late permissions/acknowledgements, denied microphones, background operation beyond 30 seconds and sign-out. Default CI uses local host candidates. For a browser with managed UDP restrictions, set `CALL_TEST_ICE_SERVERS` to a JSON array containing a test TURN configuration; do not change the policy. This workspace used an ephemeral loopback TURN/TCP test relay, which is not a production relay.

Unit tests cover worker privacy/expiry/out-of-order pushes, webhook authentication/routing, duplicate claims, expired endpoints and subscriptions. `tests/calls-database.sql` verifies real Postgres roles and transitions inside rollback with the call push trigger disabled, so real users receive no test calls. Apply `supabase/calls.sql` once, then deploy `universe-push` with its existing custom webhook authentication and `verify_jwt: false`. Existing push keys and conversations stay intact.
