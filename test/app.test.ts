import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { handle } from '../src/app'
import type { Env } from '../src/config'
import { SCRIPTS, sha256 } from '../src/scripts'
import { seedLink, testD1 } from './d1'

const CHROME =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const HTML = 'text/html,application/xhtml+xml,*/*;q=0.8'

let env: Env & { DB: ReturnType<typeof testD1> }
let pending: Promise<unknown>[]
let posted: unknown[]
const realFetch = globalThis.fetch

beforeEach(async () => {
    env = {
        DB: testD1(),
        POSTHOG_KEY: 'phc_test',
        POSTHOG_HOST: 'https://ph.test',
        HOME_URL: 'https://taraxvoid.com/',
        UTM_HOSTS: ['taraxvoid.com'],
    }
    await seedLink(env.DB, 'cv', 'https://taraxvoid.com/resume')
    await seedLink(env.DB, 'gh', 'https://github.com/taraxvoid')
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
        new Request(`https://txv.sh${path}`, { method, headers }),
        env,
        { waitUntil: (p) => pending.push(p) },
    )
    await Promise.all(pending)
    return res
}

const clicks = (slug: string) =>
    (
        env.DB.sqlite
            .query('SELECT click_count FROM links WHERE slug = ?')
            .get(slug) as { click_count: number }
    ).click_count

describe('links', () => {
    test('redirects with utm tags and records the click', async () => {
        const res = await get('/cv', { 'user-agent': CHROME, accept: HTML })
        expect(res.status).toBe(302)
        const to = new URL(res.headers.get('location') ?? '')
        expect(to.origin + to.pathname).toBe('https://taraxvoid.com/resume')
        expect(to.searchParams.get('utm_source')).toBe('txv.sh')
        expect(to.searchParams.has('rvnflt_cid')).toBe(false)
        expect(clicks('cv')).toBe(1)
        expect(posted).toHaveLength(1)
        expect(posted[0]).toMatchObject({
            event: 'txv_link_clicked',
            properties: { slug: 'cv', utm_campaign: 'cv' },
        })
    })
    test('is case-insensitive and tolerates a trailing slash', async () => {
        expect((await get('/CV/')).status).toBe(302)
    })
    test('bots and HEAD requests are redirected but not counted', async () => {
        expect(
            (await get('/cv', { 'user-agent': 'Slackbot 1.0' })).status,
        ).toBe(302)
        expect((await get('/cv', { 'user-agent': 'curl/8.4.0' })).status).toBe(
            302,
        )
        expect(
            (await get('/cv', { 'user-agent': CHROME }, 'HEAD')).status,
        ).toBe(302)
        expect(clicks('cv')).toBe(0)
        expect(posted).toHaveLength(0)
    })
    test('sends only the referrer host, never the user-agent', async () => {
        await get('/gh', {
            'user-agent': CHROME,
            referer: 'https://news.example/item?id=1',
        })
        const props = (posted[0] as { properties: Record<string, unknown> })
            .properties
        expect(props.referrer_host).toBe('news.example')
        expect(JSON.stringify(props)).not.toContain('Chrome')
    })
    test('a failed click count does not break the redirect', async () => {
        const log = spyOn(console, 'error').mockImplementation(() => {})
        env.DB.sqlite.run('DROP TABLE links')
        env.DB.sqlite.run(
            'CREATE TABLE links (slug TEXT, destination_url TEXT)',
        )
        await seedLink(env.DB, 'cv', 'https://taraxvoid.com/')
        expect((await get('/cv', { 'user-agent': CHROME })).status).toBe(302)
        expect(log).toHaveBeenCalled()
        expect(posted).toHaveLength(1)
        log.mockRestore()
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
        const body = await res.text()
        const sh = Bun.spawnSync(['sh'], { stdin: new Blob([body]) })
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
    })
    test('.sha256 is sha256sum -c format', async () => {
        const res = await get('/verify.sha256')
        const digest = await sha256(SCRIPTS.verify ?? '')
        expect(await res.text()).toBe(`${digest}  verify.sh\n`)
    })
    test('win over a link of the same name, without touching D1', async () => {
        env.DB.sqlite.run('DROP TABLE links')
        expect((await get('/verify')).status).toBe(200)
    })
})

describe('root and misc', () => {
    test('browsers at / go home; curl gets the index', async () => {
        const res = await get('/', { accept: HTML })
        expect(res.status).toBe(302)
        expect(res.headers.get('location')).toBe('https://taraxvoid.com/')
        const text = await (await get('/', { accept: '*/*' })).text()
        expect(text).toContain('verify')
        expect(text).toContain('gh attestation verify')
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
