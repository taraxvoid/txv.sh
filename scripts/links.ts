#!/usr/bin/env bun
// txv.sh's links are managed in taraxvoid/infra's redirects.ts now: change
// them with a PR there, and its CI redeploys txv.sh. This script only reads.
//
//   bun run links ls        click counts, busiest first
//   bun run links export    the pre-voidlink D1 links, as redirects.ts entries
//
// Uses your own wrangler login; --local reads `wrangler dev`'s database.

const MOVED = `links are managed in taraxvoid/infra (redirects.ts) now:
  edit redirects.ts in a PR; merging it redeploys txv.sh.
  \`bun run links export\` prints the old D1 links in that format.`

function fail(message: string): never {
    console.error(message)
    return process.exit(1) as never
}

const argv = Bun.argv.slice(2)
const local = argv.includes('--local')
const [command] = argv.filter((a) => a !== '--local')

function d1(sql: string): Record<string, unknown>[] {
    const proc = Bun.spawnSync(
        [
            'wrangler',
            'd1',
            'execute',
            'txv-sh',
            local ? '--local' : '--remote',
            '--json',
            '--command',
            sql,
        ],
        { stderr: 'pipe', stdout: 'pipe' },
    )
    const out = proc.stdout.toString()
    if (proc.exitCode !== 0) fail(proc.stderr.toString() || out)
    const [result] = JSON.parse(out) as { results: Record<string, unknown>[] }[]
    if (!result) fail(`unexpected wrangler output: ${out}`)
    return result.results
}

// JSON string literals are valid TypeScript, with newlines and quotes escaped.
const quote = (s: unknown) => JSON.stringify(String(s))

const hasTable = (name: string) =>
    d1(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${name}'`)
        .length > 0

switch (command) {
    case 'ls': {
        // voidlink creates its table on the first counted click.
        const rows = hasTable('voidlink_clicks')
            ? d1(
                  'SELECT slug, click_count, last_clicked_at FROM voidlink_clicks ORDER BY click_count DESC, slug',
              )
            : []
        if (!rows.length) console.log('no clicks yet')
        else console.table(rows)
        break
    }
    case 'export': {
        if (!hasTable('links')) {
            fail(
                'no pre-voidlink `links` table in this database: nothing to export',
            )
        }
        const rows = d1(
            'SELECT slug, destination_url, note FROM links ORDER BY slug',
        )
        console.log("    'txv.sh': {")
        for (const r of rows) {
            const title = r.note ? `, title: ${quote(r.note)}` : ''
            console.log(
                `        ${quote(r.slug)}: { to: ${quote(r.destination_url)}${title} },`,
            )
        }
        console.log('    },')
        console.error(
            `${rows.length} links. All unlisted: add public: true to the ones the index should show.`,
        )
        break
    }
    case 'add':
    case 'set':
    case 'rm':
        fail(`\`links ${command}\` is retired. ${MOVED}`)
        break
    default:
        fail(`usage: bun run links ls|export [--local]\n${MOVED}`)
}
