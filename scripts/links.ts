#!/usr/bin/env bun
// Manage txv.sh short links in D1.
//
//   bun run links ls
//   bun run links add <slug> <https-url> [note...]
//   bun run links set <slug> <https-url> [note...]
//   bun run links rm <slug>
//
// Remote (production) by default; --local targets `wrangler dev`'s database.
import { linkError } from '../src/links'
import { SCRIPTS } from '../src/scripts'
import { addSql, existsSql, listSql, rmSql, setSql } from './link-sql'

type Result = {
    results: Record<string, unknown>[]
    meta: { changes?: number }
}

const USAGE = `usage:
  bun run links ls
  bun run links add <slug> <https-url> [note...]
  bun run links set <slug> <https-url> [note...]
  bun run links rm <slug>
flags: --local (default: remote)`

function fail(message: string): never {
    console.error(message)
    return process.exit(1) as never
}

const argv = Bun.argv.slice(2)
const local = argv.includes('--local')
const [command, slug, url, ...noteWords] = argv.filter((a) => a !== '--local')
const note = noteWords.length ? noteWords.join(' ') : undefined

function d1(sql: string): Result {
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
    const [result] = JSON.parse(out) as Result[]
    if (!result) fail(`unexpected wrangler output: ${out}`)
    return result
}

function checked(slug?: string, url?: string): [string, string] {
    if (!slug || !url) fail(USAGE)
    const error = linkError(slug, url, Object.keys(SCRIPTS))
    if (error) fail(error)
    return [slug, url]
}

switch (command) {
    case 'ls': {
        const { results } = d1(listSql)
        if (!results.length) console.log('no links')
        else console.table(results)
        break
    }
    case 'add': {
        const [s, u] = checked(slug, url)
        const taken = d1(existsSql(s))
        if (taken.results.length) fail(`"${s}" exists; use \`links set\``)
        d1(addSql(s, u, note))
        console.log(`https://txv.sh/${s} -> ${u}`)
        break
    }
    case 'set': {
        const [s, u] = checked(slug, url)
        if (!d1(setSql(s, u, note)).meta.changes) fail(`no link "${s}"`)
        console.log(`https://txv.sh/${s} -> ${u}`)
        break
    }
    case 'rm': {
        if (!slug) fail(USAGE)
        if (!d1(rmSql(slug)).meta.changes) fail(`no link "${slug}"`)
        console.log(`removed ${slug}`)
        break
    }
    default:
        fail(USAGE)
}
