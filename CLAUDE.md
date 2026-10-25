# CLAUDE.md

txv.sh: short links (D1) and attested install scripts (`sh/`) on one
Cloudflare Worker. See README.md for routes, analytics and setup.

## Stack

Bun (pinned in `mise.toml`), TypeScript, wrangler, D1. No runtime
dependencies: keep it that way, since this domain serves install scripts.

```fish
bun run test:push   # lint (biome + shellcheck) + check + test
bun run dev
bun run links ls    # see scripts/links.ts
```

Hooks come from voidflow's `lefthook/base.yml` (`mise install` for lefthook).
Never bypass them with `--no-verify`.

## Rules that matter

- **Served bytes = attested bytes.** `sh/*.sh` is imported as text (wrangler
  `rules`, bunfig `[loader]`) and never transformed. The attest step stays in
  `.github/workflows/ci.yml`, ahead of the deploy; `sh/verify.sh` pins that
  workflow as the signer. If you move it, update both.
- **New script:** add `sh/<name>.sh` (POSIX sh, `#!/bin/sh`, then a `# `
  summary line) and register it in `src/scripts.ts`. Put the body inside a
  function that the last line calls, so a script that is piped to sh can't
  run half-downloaded.
- **Analytics is for links only.** Scripts are never counted. PostHog events
  stay anonymous (no IP, no user-agent, no person profile). If you add a
  property, add it to README's Analytics section too.
- **The repo is public.** Link destinations stay in D1, never in the repo;
  secrets go in Worker or GitHub secrets.
- **Style.** Biome: 4 spaces, single quotes, no semicolons, 80 columns. Pure
  logic lives in `src/` with a test in `test/`.
- Conventional commits.
