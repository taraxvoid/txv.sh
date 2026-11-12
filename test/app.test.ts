import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { buildLinks, handle } from '@taraxvoid/voidlink'
import type { Env } from '../src/config'
import { routes } from '../src/routes'
import { SCRIPTS, sha256 } from '../src/scripts'
import site from '../voidlink.config'
import { testD1 } from './d1'

const CHROME =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const HTML = 'text/html,application/xhtml+xml,*/*;q=0.8'

// Sample links: the real ones live in taraxvoid/infra, not in this repo.
const links = buildLinks(
    {
        cv: {
            to: 'https://taraxvoid.com/resume',
            public: true,
            title: 'Resume',
        },
        gh: 'https://github.com/taraxvoid',
    },
    site,
)

let env: Env & { DB: ReturnType<typeof testD1> }
let pending: Promise<unknown>[]
let posted: Array<{ event: string; properties: Record<string, unknown> }>
const realFetch = globalThis.fetch

beforeEach(() => {
    env = {
        DB: testD1(),
        POSTHOG_KEY: 'phc_test',
        POSTHOG_HOST: 'https://ph.test',
    }
    pending = []
    posted = []
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        posted.push(JSON.parse(String(init?.body)))
        return new Response('ok')
    }) as typeof fetch
})
afterEach(() => {
    globalThis.fetch = realFetch
})

async function get(
    path: string,
    headers: Record<string, string> = {},
    method = 'GET',
) {
    const res = await handle(
        { site, links, routes: routes(links) },
        new Request(`https://txv.sh${path}`, { method, headers }),
        env,
        { waitUntil: (p) => pending.push(p) },
    )
    await Promise.all(pending)
    return res
}

function clicks(slug: string): number {
    const db = env.DB.sqlite
    if (
        !db
            .query("SELECT 1 FROM sqlite_master WHERE name = 'voidlink_clicks'")
            .get()
    )
        return 0
    const row = db
        .query('SELECT click_count FROM voidlink_clicks WHERE slug = ?')
        .get(slug) as { click_count: number } | null
    return row?.click_count ?? 0
}

describe('links', () => {
    test('redirects with utm tags and records the click', async () => {
        const res = await get('/cv', { 'user-agent': CHROME, accept: HTML })
        expect(res.status).toBe(302)
        const to = new URL(res.headers.get('location') ?? '')
        expect(to.origin + to.pathname).toBe('https://taraxvoid.com/resume')
        expect(to.searchParams.get('utm_source')).toBe('txv.sh')
        expect(clicks('cv')).toBe(1)
        expect(posted).toHaveLength(1)
        expect(posted[0]).toMatchObject({
            event: 'txv_link_clicked',
            properties: { source: 'txv.sh', slug: 'cv', utm_campaign: 'cv' },
        })
    })
    test('sends only the referrer host, never the user-agent', async () => {
        await get('/gh', {
            'user-agent': CHROME,
            referer: 'https://news.example/item?id=1',
        })
        const props = posted[0]?.properties ?? {}
        expect(props.referrer_host).toBe('news.example')
        expect(JSON.stringify(props)).not.toContain('Chrome')
    })
    test('curl is redirected but not counted', async () => {
        expect((await get('/cv', { 'user-agent': 'curl/8.4.0' })).status).toBe(
            302,
        )
        expect(clicks('cv')).toBe(0)
        expect(posted).toHaveLength(0)
    })
    test('no link may take a script name', () => {
        expect(() =>
            buildLinks({ verify: 'https://taraxvoid.com/' }, site),
        ).toThrow('reserved')
    })
})

describe('not found', () => {
    test('browsers get an HTML page', async () => {
        const res = await get('/nope', { accept: HTML })
        expect(res.status).toBe(404)
        expect(res.headers.get('content-type')).toContain('text/html')
        expect(await res.text()).toContain('https://taraxvoid.com/')
    })
    test('curl gets a body that fails when piped to sh', async () => {
        const res = await get('/nope', { accept: '*/*' })
        expect(res.status).toBe(404)
        const sh = Bun.spawnSync(['sh'], {
            stdin: new Blob([await res.text()]),
        })
        expect(sh.exitCode).toBe(1)
        expect(sh.stderr.toString()).toContain('nothing at /nope')
    })
    test('the echoed path cannot inject shell', async () => {
        const res = await get('/a%22%3Btouch%20x%3B%22', { accept: '*/*' })
        expect(await res.text()).not.toMatch(/[";]touch/)
    })
})

describe('scripts', () => {
    test('served as text with their checksum, and never counted', async () => {
        const res = await get('/verify', { 'user-agent': CHROME })
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/plain')
        const digest = await sha256(SCRIPTS.verify ?? '')
        expect(res.headers.get('x-content-sha256')).toBe(digest)
        expect(await res.text()).toBe(SCRIPTS.verify ?? '')
        expect(posted).toHaveLength(0)
        expect(clicks('verify')).toBe(0)
    })
    test('.sha256 is sha256sum -c format', async () => {
        const res = await get('/verify.sha256')
        const digest = await sha256(SCRIPTS.verify ?? '')
        expect(await res.text()).toBe(`${digest}  verify.sh\n`)
    })
    test('work without D1', async () => {
        env.DB.sqlite.close()
        expect((await get('/verify')).status).toBe(200)
    })
})

describe('root and misc', () => {
    test('browsers at / get the public links', async () => {
        const res = await get('/', { accept: HTML })
        expect(res.status).toBe(200)
        const html = await res.text()
        expect(html).toContain('href="/cv"')
        expect(html).toContain('Resume')
        expect(html).not.toContain('href="/gh"')
        expect(html).toContain('https://taraxvoid.com/')
    })
    test('curl gets the index: Tara, scripts, then public links', async () => {
        const text = await (await get('/', { accept: '*/*' })).text()
        expect(text).toContain('github.com/taraxvoid')
        expect(text).toContain('gh attestation verify')
        expect(text).toContain('txv.sh/cv  Resume')
        expect(text).not.toContain('txv.sh/gh')
    })
    test('the index is a no-op when piped to sh', async () => {
        const text = await (await get('/', { accept: '*/*' })).text()
        for (const line of text.trimEnd().split('\n')) {
            expect(line.startsWith('#')).toBe(true)
            expect(line.length).toBeLessThanOrEqual(80)
            expect(line).toMatch(/^[\x20-\x7e]*$/)
        }
        const sh = Bun.spawnSync(['sh'], { stdin: Buffer.from(text) })
        expect(sh.exitCode).toBe(0)
        expect(sh.stdout.toString()).toBe('')
    })
    test('a link title is kept printable and within 80 columns', async () => {
        const long = buildLinks(
            {
                x: {
                    to: 'https://taraxvoid.com/',
                    public: true,
                    title: `Résumé ${'long '.repeat(30)}`,
                },
            },
            site,
        )
        const res = await handle(
            { site, links: long, routes: routes(long) },
            new Request('https://txv.sh/'),
            env,
            { waitUntil() {} },
        )
        for (const line of (await res.text()).trimEnd().split('\n')) {
            expect(line.length).toBeLessThanOrEqual(80)
            expect(line).toMatch(/^[\x20-\x7e]*$/)
        }
    })
    test('health', async () => {
        expect(await (await get('/_health')).json()).toEqual({ ok: true })
    })
    test('only GET and HEAD', async () => {
        const res = await get('/cv', {}, 'POST')
        expect(res.status).toBe(405)
        expect(res.headers.get('allow')).toBe('GET, HEAD')
    })
})
