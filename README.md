# txv.sh

Short links and attested install scripts for Tara X Void, on Cloudflare
Workers. The short links run on [voidlink](https://github.com/taraxvoid/voidlink).

```sh
curl txv.sh                                  # what's here
curl -fsSL txv.sh/verify | sh -s -- <name>   # check a script's attestation, then run it
curl -fsSL txv.sh/voidflow | sh -s -- init --kind tool   # set up a new repo
open https://txv.sh/<slug>                   # a short link
```

## Routes

| Path                    | What                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `/`                     | Browsers get the public links; `curl` gets a plain-text index |
| `/<name>`, `/<name>.sh` | `sh/<name>.sh`, as text, with an `x-content-sha256` header    |
| `/<name>.sha256`        | Checksum in `sha256sum -c` format                             |
| `/<slug>`               | 302 to the link (case-insensitive, trailing `/` ok)           |
| `/_health`              | `{ "ok": true }` when D1 (click counts) answers               |

A script owns its name: no link may use it (`voidlink.config.ts` reserves
every script). Scripts and links are both served from the bundle, so they keep
working if D1 is down. Unknown paths get an HTML page in a browser, and
otherwise a body that fails loudly if it gets piped to `sh`. The `curl` index
is who this is, script usage and the public links, written entirely as `#`
comments, so piping it to `sh` does nothing.

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

`txv.sh/voidflow` runs [voidflow](https://github.com/taraxvoid/voidflow)'s
CLI at the version pinned in `sh/voidflow.sh`. It downloads that tarball from
npm, checks its attestation from voidflow's release workflow, then runs the
same bytes with `bun`, so nothing unchecked runs and nothing is installed. Like
`verify`, it falls back to `mise x` for `bun` and `gh`, and `gh` needs to be
signed in. Renovate bumps the pin (the `customManagers` entry in
`renovate.json` reads the `# renovate:` comment above it), so each voidflow
release is a reviewed PR here.

To add a script, put `sh/<name>.sh` in place (with a `#!/bin/sh` line, then a
`# ` summary line, which `curl txv.sh` lists) and register it in
`src/scripts.ts`. Tests fail if a file isn't registered.

## Links

Links live in `redirects.ts` in [taraxvoid/infra](https://github.com/taraxvoid/infra),
which is private, so the destinations stay private while this repo is public:

```ts
'txv.sh': {
    cv: { to: 'https://taraxvoid.com/resume', public: true, title: 'Resume' },
    gh: 'https://github.com/taraxvoid', // unlisted: redirects, not on the index
},
```

To add, change or remove a link, open a PR there. infra's CI shows the
change in the job summary. Merging runs this repo's deploy
(`workflow_dispatch`), which reads the file with a read-only GitHub App token,
checks it (`voidlink build`: https only, not back at txv.sh, not a script's
name) and bundles the links into the Worker. Only links marked `public` are on
the index page. An unlisted link is hidden from the page, not secret.

```sh
bun run links ls        # click counts (your wrangler login; --local for dev)
bun run links export    # the old D1 links, as redirects.ts entries
```

`bun run links add/set/rm` are retired: they wrote to D1, which the Worker no
longer reads links from.

## Analytics

Only for links, never scripts. Each human click (crawlers, link previews,
HTTP clients and `HEAD` requests are skipped):

- adds one to its count in D1 (`bun run links ls` shows it). voidlink
  creates that table through the Worker's binding, so the deploy runs no
  migrations and its token needs no D1 permission;
- sends PostHog one anonymous `txv_link_clicked` event: slug, destination
  without its query, referrer host, country and utm tags. It has no person
  profile and no GeoIP, sends no IP or user-agent, and uses a new random id
  for each event;
- tags destinations on `utmHosts` (taraxvoid.com, taraxvoid.net) with
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
bun run dev     # with no links: `bun run links:empty` writes links.gen.json
bun run test:push
```

Deploys go from CI on `main` (voidflow's `tool-ci` validates first), and when
infra runs the workflow after a links change. They need, in the `prod`
environment:

- `vars.CLOUDFLARE_ACCOUNT_ID` and a `CLOUDFLARE_API_TOKEN` secret that can
  deploy this one Worker and manage the `txv.sh` custom domain (voidflow's
  `cf-tokens`; no D1 grant);
- `vars.LINKS_BOT_CLIENT_ID` and a `LINKS_BOT_PRIVATE_KEY` secret: a GitHub
  App installed on taraxvoid/infra with read-only Contents.

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
  Cloudflare token and App key are GitHub secrets, and links are in
  taraxvoid/infra. The deploy log prints link counts, never destinations.
- Report a security problem with a script privately; see
  [SECURITY.md](SECURITY.md).
