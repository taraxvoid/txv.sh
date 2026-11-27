import { cachedLinks, isBrowser, type Routes } from '@taraxvoid/voidlink'
import { type Env, HOST } from './config'
import { indexText } from './pages'
import { SCRIPTS, scriptRoute, sha256 } from './scripts'

const TEXT = { 'content-type': 'text/plain; charset=utf-8' }

/**
 * txv.sh's own routes, ahead of voidlink's: the curl index at `/`, and the
 * install scripts. Scripts come from the bundle, never D1, so they keep
 * working if D1 is down, and they're never counted.
 */
export const routes: Routes<Env> = async (req, url, env) => {
    if (url.pathname === '/' && !isBrowser(req)) {
        // Links come from D1 (cached 30 s per isolate); if D1 is down the
        // index still lists the scripts.
        const links = env.DB ? ((await cachedLinks(env.DB, HOST)) ?? {}) : {}
        return new Response(indexText(links), { headers: TEXT })
    }
    const script = scriptRoute(url.pathname)
    if (!script) return undefined
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
