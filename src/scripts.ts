import verify from '../sh/verify.sh'

/**
 * Every file in sh/, by name (`sh/<name>.sh` is served at `/<name>`).
 * test/scripts.test.ts fails if one is missing here.
 */
export const SCRIPTS: Readonly<Record<string, string>> = { verify }

/** The first comment line after the shebang: the script's one-line summary. */
export function summary(text: string): string {
    const line = text.split('\n').find((l, i) => i > 0 && l.startsWith('# '))
    return line?.slice(2).trim() ?? ''
}

export async function sha256(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/** `/verify`, `/verify.sh` and `/verify.sha256` all name the verify script. */
export function scriptRoute(
    pathname: string,
): { name: string; checksum: boolean } | null {
    const match = /^\/([a-z0-9-]+)(\.sh|\.sha256)?$/.exec(pathname)
    const name = match?.[1]
    if (!name || !Object.hasOwn(SCRIPTS, name)) return null
    return { name, checksum: match[2] === '.sha256' }
}
