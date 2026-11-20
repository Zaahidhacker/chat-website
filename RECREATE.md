# Recreate the website

## Run from a fresh clone

Use Node.js 22 (the version used by GitHub Actions) and npm. Run these commands with access to the private repository.

```sh
git clone https://github.com/Zaahidhacker/chat-website.git
cd chat-website
npm ci
npm test
npm run build
npm start
```

Open `http://localhost:3000`. The build writes the complete static site to `dist/`. The default browser configuration points to the original backend. Use the steps below to give your copy its own accounts and data. To exercise two-way messaging with test accounts and a local test transport, run `npx playwright install chromium` and `npm run test:browser`.

## Create an independent Supabase backend

1. Create an empty Supabase project with Email Auth, Data API, Realtime, Storage, and Vault. Enable `pgcrypto` in the `extensions` schema for invitation hashing. The SQL uses `pg_net` for push and `pg_cron` for voice-note expiry.
2. In the Supabase SQL Editor, run `supabase/001_universe.sql` through `supabase/016_private_location_sharing.sql` in numeric order. Before running `009_private_push.sql`, replace the existing `/functions/v1/universe-push` URL with the URL for the new project. Then apply `supabase/project28.sql`, `supabase/anniversary-2026.sql`, `supabase/anniversary-letter-polish.sql`, `supabase/audio.sql`, and `supabase/private-presence.sql` in that order. Apply these files once to an empty project. Keep the existing anniversary letter intact until the letter-polish script has run, since it checks the original letter's checksum.
3. Update the Supabase project URL and browser publishable key in both `src/app.js` and `src/photos.js`. Also replace the project reference in the `sb-…-auth-token` storage key in `src/app.js`. In `vercel.json`, update the HTTPS and WSS Supabase origins in the Content Security Policy to match the new project. Keep privileged keys on the server.
4. In Supabase Auth, enable email signup and configure email confirmation and delivery. Set **Site URL** to the new deployment URL and allow it in **Redirect URLs**. Add `http://localhost:3000` to the redirect allowlist for local signup testing if needed.
5. Generate two random invitation codes with `openssl rand -hex 24`, one per member. Calculate each hash with `printf '%s' 'COPY_THE_CODE_HERE' | openssl dgst -sha256`. Run the SQL below with the two members' actual details and hashes. Share each plaintext code privately. Each member enrolls via **First time here? Set your password** and confirms their email.

```sql
insert into universe_private.invites (email, token_hash, slot, name)
values
  ('first@example.com', 'FIRST_SHA256_HEX_HASH', 1, 'First member'),
  ('second@example.com', 'SECOND_SHA256_HEX_HASH', 2, 'Second member');
```

The SQL files create the tables, permissions, buckets, feature defaults, and anniversary letter. Project 28 starts unpublished. Use its owner controls to add and release content for the second member. Accounts, chat history, photos, recordings, and other user-created data live in Supabase and require a separate private export if you want to migrate them. The anniversary and Project 28 soundtrack URLs are in `src/anniversary-content.js` and `src/project28-content.js`. Playback depends on the external audio host. The map uses OpenStreetMap tiles.

## Enable phone notifications

Deploy `supabase/functions/universe-push` to the new project with platform JWT verification disabled for that function. The function authenticates requests with its own webhook secret. Set the VAPID contact URL inside the function to the new site's HTTPS URL before deploying it.

Generate a new VAPID key pair (for example, with `npx web-push generate-vapid-keys`) and a random webhook secret (`openssl rand -hex 32`). In Supabase Vault, save the VAPID private key and webhook secret. Run the following SQL with their Vault record IDs.

```sql
insert into universe_private.push_config (public_key, private_secret, webhook_secret, enabled)
values ('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY_VAULT_UUID', 'WEBHOOK_SECRET_VAULT_UUID', true);
```

After deployment, both members can enable push on supported devices from **Settings → Manage phone notifications**.

## Deploy and verify

Import the repository into Vercel. `vercel.json` specifies the install and build commands, `dist/` as the output directory, and the cache and security headers. With a different static host, configure the equivalent headers there. Use HTTPS for service workers, phone notifications, microphone, and location support.

Open the deployed site in two separate browser profiles and enroll the two test accounts. Send a message, photo, and voice note in both directions. Verify that the garden and island load, then test any enabled features that depend on browser permissions or external providers.
