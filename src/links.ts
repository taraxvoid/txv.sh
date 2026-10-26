import { HOST } from './config'

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export const UTM_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
] as const

/** `/CV/` and `/cv` are the same link; anything else that isn't a slug is null. */
export function slugFromPath(pathname: string): string | null {
    const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
    return SLUG_RE.test(slug) ? slug : null
}

/** Why a link can't be stored, or null when it can. */
export function linkError(
    slug: string,
    destination: string,
    scripts: readonly string[],
): string | null {
    if (!SLUG_RE.test(slug)) {
        return `invalid slug "${slug}": lowercase letters, digits and hyphens, max 64`
    }
    if (scripts.includes(slug)) return `"${slug}" is a script in sh/`
    let url: URL
    try {
        url = new URL(destination)
    } catch {
        return `invalid destination URL: "${destination}"`
    }
    if (url.protocol !== 'https:') return 'destination must be https'
    if (hostMatches(url.hostname, [HOST])) {
        return `destination points back at ${HOST}`
    }
    return null
}

export function hostMatches(host: string, hosts: readonly string[]): boolean {
    return hosts.some((h) => host === h || host.endsWith(`.${h}`))
}

/**
 * The redirect target: the stored URL, plus default utm_ tags when it's one
 * of our own hosts, with any utm_ params on the short link itself winning.
 * Other query params on the short link are dropped.
 */
export function destinationFor(
    stored: string,
    slug: string,
    incoming: URLSearchParams,
    utmHosts: readonly string[],
): URL {
    const url = new URL(stored)
    if (hostMatches(url.hostname, utmHosts)) {
        const defaults = {
            utm_source: HOST,
            utm_medium: 'shortlink',
            utm_campaign: slug,
        }
        for (const [key, value] of Object.entries(defaults)) {
            if (!url.searchParams.has(key)) url.searchParams.set(key, value)
        }
    }
    for (const key of UTM_KEYS) {
        const value = incoming.get(key)
        if (value) url.searchParams.set(key, value)
    }
    return url
}
