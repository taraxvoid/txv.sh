import { isBotUserAgent } from './bot'
import type { Env } from './config'
import { destinationFor, slugFromPath, UTM_KEYS } from './links'
import { indexText, notFoundHtml, notFoundText } from './pages'
import { capture } from './posthog'
import { SCRIPTS, scriptRoute, sha256 } from './scripts'

type Ctx = Pick<ExecutionContext, 'waitUntil'>

const TEXT = { 'content-type': 'text/plain; charset=utf-8' }

export async function handle(
    req: Request,
    env: Env,
    ctx: Ctx,
): Promise<Response> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return new Response('method not allowed\n', {
            status: 405,
            headers: { ...TEXT, allow: 'GET, HEAD' },
        })
    }
    const url = new URL(req.url)
    const browser = (req.headers.get('accept') ?? '').includes('text/html')

    if (url.pathname === '/') {
        return browser
            ? Response.redirect(env.HOME_URL, 302)
            : new Response(indexText(), { headers: TEXT })
    }
    if (url.pathname === '/_health') return health(env)

    // Scripts come from the bundle, not D1, so they keep working if D1 is
    // down, and they're never counted: analytics is for links to pages.
    const script = scriptRoute(url.pathname)
    if (script) {
        const text = SCRIPTS[script.name] ?? ''
        const digest = await sha256(text)
        const body = script.checksum ? `${digest}  ${script.name}.sh\n` : text
        return new Response(body, {
            headers: {
                ...TEXT,
                'cache-control': 'public, max-age=300',
                'x-content-sha256': digest,
                'x-content-type-options': 'nosniff',
            },
        })
    }

    const slug = slugFromPath(url.pathname)
    const row = slug
        ? await env.DB.prepare(
              'SELECT destination_url FROM links WHERE slug = ?',
          )
              .bind(slug)
              .first<{ destination_url: string }>()
        : null
    if (!slug || !row) {
        return browser
            ? new Response(notFoundHtml(env.HOME_URL), {
                  status: 404,
                  headers: { 'content-type': 'text/html; charset=utf-8' },
              })
            : new Response(notFoundText(url.pathname), {
                  status: 404,
                  headers: TEXT,
              })
    }

    const destination = destinationFor(
        row.destination_url,
        slug,
        url.searchParams,
        env.UTM_HOSTS,
    )
    if (
        req.method === 'GET' &&
        !isBotUserAgent(req.headers.get('user-agent'))
    ) {
        ctx.waitUntil(recordClick(req, env, slug, destination))
    }
    return Response.redirect(destination.toString(), 302)
}

async function recordClick(
    req: Request,
    env: Env,
    slug: string,
    destination: URL,
): Promise<void> {
    const utm = Object.fromEntries(
        UTM_KEYS.flatMap((key) => {
            const value = destination.searchParams.get(key)
            return value ? [[key, value]] : []
        }),
    )
    await Promise.all([
        countClick(env, slug),
        capture(env.POSTHOG_KEY, env.POSTHOG_HOST, 'txv_link_clicked', {
            slug,
            destination: destination.origin + destination.pathname,
            referrer_host: referrerHost(req.headers.get('referer')),
            country: req.cf?.country,
            ...utm,
        }),
    ])
}

async function countClick(env: Env, slug: string): Promise<void> {
    try {
        await env.DB.prepare(
            "UPDATE links SET click_count = click_count + 1, last_clicked_at = datetime('now') WHERE slug = ?",
        )
            .bind(slug)
            .run()
    } catch (err) {
        console.error('click count failed:', err)
    }
}

function referrerHost(referer: string | null): string | undefined {
    if (!referer) return undefined
    try {
        return new URL(referer).host
    } catch {
        return undefined
    }
}

async function health(env: Env): Promise<Response> {
    try {
        await env.DB.prepare('SELECT 1').first()
        return Response.json({ ok: true })
    } catch (err) {
        console.error('health check failed:', err)
        return Response.json({ ok: false }, { status: 500 })
    }
}
