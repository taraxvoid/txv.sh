# txv.sh

Short links and attested install scripts for Tara X Void, on Cloudflare
Workers and D1.

```sh
curl txv.sh                                  # what's here
curl -fsSL txv.sh/verify | sh -s -- <name>   # check a script's attestation, then run it
open https://txv.sh/<slug>                   # a short link
```

## Routes

| Path | What |
| --- | --- |
| `/` | Browsers go to taraxvoid.com; `curl` gets a plain-text index |
| `/<name>`, `/<name>.sh` | `sh/<name>.sh`, as text, with an `x-content-sha256` header |
| `/<name>.sha256` | Checksum in `sha256sum -c` format |
| `/<slug>` | 302 to the link stored in D1 (case-insensitive, trailing `/` ok) |
| `/_health` | `{ "ok": true }` when D1 answers |

A script wins over a link with the same name, and is served from the bundle,
so scripts keep working if D1 is down. Unknown paths get an HTML page in a
browser, and otherwise a body that fails loudly if it gets piped to `sh`.

## Scripts and attestations

Each deploy from `main` attests `sh/*.sh` with
[GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
before it ships them, and then checks that what's live matches the checkout
and verifies. To check a script yourself:

```sh
curl -fsSL txv.sh/<name> -o <name>.sh
gh attestation verify <name>.sh --repo taraxvoid/txv.sh \
  --source-ref refs/heads/main \
  --signer-workflow taraxvoid/txv.sh/.github/workflows/ci.yml
```

`txv.sh/verify` does that for you, then runs the script. It uses `gh` if you
have it, and otherwise `mise x gh`, so [mise](https://mise.jdx.dev) alone is
enough. `gh` needs to be signed in. `verify` can't check itself, so read it
first (it's short), or verify it by hand once.

To add a script, put `sh/<name>.sh` in place (with a `#!/bin/sh` line, then a
`# ` summary line, which `curl txv.sh` lists) and register it in
`src/scripts.ts`. Tests fail if a file isn't registered.

## Links

```sh
bun run links ls
bun run links add cv https://taraxvoid.com/resume "resume, for print"
bun run links set cv https://taraxvoid.com/resume.pdf
bun run links rm cv
```

Production by default; add `--local` for `wrangler dev`'s database.
Destinations must be https and can't point back at txv.sh. Links are kept in
D1, not in this repo, so the list stays private while the code is public.

## Analytics

Only for links, never scripts. Each human click (crawlers, link previews,
HTTP clients and `HEAD` requests are skipped):

- adds one to `click_count` in D1 (`bun run links ls` shows it);
- sends PostHog one anonymous `txv_link_clicked` event: slug, destination
  without its query, referrer host, country and utm tags. It has no person
  profile and no GeoIP, sends no IP or user-agent, and uses a new random id
  for each event;
- tags destinations on `UTM_HOSTS` (taraxvoid.com, taraxvoid.net) with
  `utm_source=txv.sh&utm_medium=shortlink&utm_campaign=<slug>`, so the
  site's own PostHog credits the visit. utm params on the short link
  (`txv.sh/cv?utm_source=meetup`) win over those and are passed to any
  destination.

PostHog stays off until the key is set: `wrangler secret put POSTHOG_KEY`.
Use the same project as taraxvoid.com so you can follow a click through to
the visit.

## Setup

```sh
mise install    # bun, lefthook, shellcheck
bun install
bun run dev     # then: bun run db:migrate:local
bun run test:push
```

Deploys go from CI on `main` (voidflow's `tool-ci` validates first). They
need `vars.CLOUDFLARE_ACCOUNT_ID` and a `CLOUDFLARE_API_TOKEN` secret in the
`prod` environment that can deploy Workers, edit D1 and manage the
`txv.sh` custom domain. The D1 database is created on the first deploy.

## Public repo

This repo is public, and that matters most for `sh/`, since people pipe it to
a shell:

- Issues and PRs are welcome. CI on a PR (forks included) only validates. It
  never gets secrets, deploys or attests, so the only way to get an
  attestation is a commit on `main`.
- Please protect `main` (require a PR and the Validate check) so that holds.
- Attestations are signed with Sigstore's public instance, so each one (repo,
  commit, workflow, script digest) is also published to its public
  transparency log.
- Nothing secret lives here: the PostHog key is a Worker secret, the
  Cloudflare token a GitHub secret, and links are in D1.
- Report a security problem with a script privately; see
  [SECURITY.md](SECURITY.md).
