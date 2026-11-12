import { HOST, REPO } from './config'
import { SCRIPTS, summary } from './scripts'

/**
 * Shown above the script usage. Plain ASCII, one screen. Personal text, not
 * covered by the MIT license (see README); forks should replace it.
 */
const ABOUT = `Tara X Void
Platform, DevEx and security engineer. Omaha, NE.
CI/CD, supply-chain security and coding-agent guardrails. Founder of
RavenFlight Industries.

  resume    https://taraxvoid.net/resume
  web       https://taraxvoid.com
  github    https://github.com/taraxvoid
  linkedin  https://linkedin.com/in/taraxvoid`

/**
 * Prefix every line with `# ` so the whole body is a shell comment:
 * `curl txv.sh | sh` does nothing instead of running prose.
 */
function asComments(text: string): string {
    return `${text
        .trimEnd()
        .split('\n')
        .map((line) => (line ? `# ${line}` : '#'))
        .join('\n')}\n`
}

/** What `curl txv.sh` prints. */
export function indexText(): string {
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

Checksums: ${HOST}/<name>.sha256`)
}

/**
 * A 404 that is safe to pipe to sh: `curl -sL txv.sh/typo | sh` prints an
 * error and fails instead of feeding an HTML page to the shell.
 */
export function notFoundText(path: string): string {
    const shown = path.replace(/[^\w./-]/g, '')
    return `echo "${HOST}: nothing at ${shown}; see https://${HOST}/" >&2\nexit 1\n`
}

export function notFoundHtml(homeUrl: string): string {
    const home = escapeHtml(homeUrl)
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5;url=${home}">
<title>Link not found - ${HOST}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 1rem/1.5 system-ui, sans-serif; padding: 1.5rem; text-align: center; }
  main { max-width: 28rem; }
</style>
</head>
<body>
<main>
  <h1>No link here</h1>
  <p>This short link doesn't point anywhere. It may have been mistyped or retired.</p>
  <p>Taking you to <a href="${home}">${escapeHtml(new URL(homeUrl).host)}</a> in 5 seconds.</p>
</main>
</body>
</html>
`
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
