# CLAUDE.md

txv.sh: short links ([voidlink](https://github.com/taraxvoid/voidlink)) and
attested install scripts (`sh/`) on one Cloudflare Worker. See README.md for
routes, analytics and setup.

## Stack

Bun (pinned in `mise.toml`), TypeScript, wrangler, D1 (click counts only).
One runtime dependency, `@taraxvoid/voidlink` (ours, attested on npm, pinned
exactly): add no others, since this domain serves install scripts.

```fish
bun run test:push   # lint (biome + shellcheck) + check + test
bun run dev
bun run links ls    # click counts; links themselves are in taraxvoid/infra
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
- **The repo is public.** Link destinations live in taraxvoid/infra's
  `redirects.ts`, never in this repo or a CI log; secrets go in Worker or
  GitHub secrets. Test links are samples.
- **No migrations in CI.** voidlink creates its D1 tables through the binding,
  so the deploy token stays scoped to this Worker with no D1 grant.
- **Style.** Biome: 4 spaces, single quotes, no semicolons, 80 columns. Pure
  logic lives in `src/` with a test in `test/`.
- Conventional commits.
