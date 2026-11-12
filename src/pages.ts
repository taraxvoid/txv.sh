import { asComments, type LinkTable, publicLinks } from '@taraxvoid/voidlink'
import { HOST, REPO } from './config'
import { SCRIPTS, summary } from './scripts'

/** Shown above the script usage. Plain ASCII, one screen. */
const ABOUT = `Tara X Void
Platform, DevEx and security engineer. Omaha, NE.

I keep the good bots in and the bad bots out: CI/CD pipelines, supply-chain
security and coding-agent guardrails. Founder of RavenFlight Industries.
Before that Lindsay, Datadog, Salesforce, Yahoo, Tile and MITRE.

  web       https://taraxvoid.com
  github    https://github.com/taraxvoid
  linkedin  https://linkedin.com/in/taraxvoid`

/** What `curl txv.sh` prints. */
export function indexText(links: LinkTable): string {
    const names = Object.keys(SCRIPTS).sort()
    const width = Math.max(...names.map((n) => n.length))
    const list = names
        .map((n) => `  ${n.padEnd(width)}  ${summary(SCRIPTS[n] ?? '')}`)
        .join('\n')
    return asComments(`${ABOUT}

${HOST}: short links and install scripts

Scripts (source: https://github.com/${REPO}/tree/main/sh):
${list}

Each one is attested by the GitHub Actions run that deployed it. Run one
after checking that attestation (needs gh, or mise to fetch it):
  curl -fsSL ${HOST}/verify | sh -s -- <name> [args...]

Or by hand:
  curl -fsSL ${HOST}/<name> -o <name>.sh
  gh attestation verify <name>.sh --repo ${REPO}
  sh <name>.sh

Checksums: ${HOST}/<name>.sha256${linkList(links)}`)
}

/** The public short links, after the scripts. Empty when there are none. */
function linkList(links: LinkTable): string {
    const list = publicLinks(links)
    if (!list.length) return ''
    const width = Math.max(...list.map((l) => l.slug.length))
    const rows = list.map(
        // The index stays printable ASCII within 80 columns, as `# ` lines.
        (l) =>
            `  ${HOST}/${l.slug.padEnd(width)}  ${l.title}`
                .replace(/[^\x20-\x7e]/g, '?')
                .slice(0, 78),
    )
    return `\n\nLinks:\n${rows.join('\n')}`
}
