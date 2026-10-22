# Roseglass design tools

The project MCP configuration is `.codex/config.toml`. Stitch uses the
`STITCH_API_KEY` environment variable for its `X-Goog-Api-Key` header. Keep the
key in the local tool environment; never put it in this repository, a Vercel
environment variable, or the website. Restart the MCP client after configuring
its environment and trusting the project configuration. Clients should resolve
the After Effects command from the repository root.

`node scripts/setup-design-mcp.mjs` installs the requested After Effects MCP in
the ignored `work/` directory at revision
`5223c17a8e8c1273b25c6a9d306839259ad35143`. Dependencies install without lifecycle
scripts, followed by the explicit TypeScript build. This optional tooling is
excluded from the website build and has no access to chat credentials.

## Capabilities verified in this workspace

The After Effects server builds successfully and answers MCP initialization,
`tools/list` (102 tools), and the `create-animation` prompt. Its rendering tools
need a running Adobe After Effects 2024+ desktop application and the repository's
CEP extension on Windows/macOS. They cannot render in this Linux environment.
No Adobe subscription was purchased or required for the browser implementation.

Stitch configuration is ready, but `stitch.googleapis.com` is outside this
workspace's enforced outbound allowlist. No Stitch design generation has been
performed. Enabling the host and setting the local environment variable are
required before a client can connect. Project configuration cannot hot-install
a tool into an already-running assistant session.

Do not send real conversations, photos, locations, account details, or backups
to either design service. Design prompts and screenshots should use fictional
sample messages only.

## Browser motion and preservation

The frontend uses CSS opacity/transform entrances and short interaction easing,
with no Adobe video exports, large animation engine, or perpetual decorative
loops. Glass blur is limited to the header, composer, and open dialog. Solid
translucent surfaces remain usable without backdrop-filter. Reduced-motion and
background animation pause rules apply throughout. Games keep their existing
pause/reward behavior.

This release changes frontend styling and developer tooling only. There are no
database migrations, message rewrites, account changes, photo uploads, progress
resets, new services, or runtime design-service requests. The existing 25,000
byte gzip initial JavaScript/CSS budget remains enforced.
