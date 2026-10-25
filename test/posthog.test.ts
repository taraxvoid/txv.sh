import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { capture } from '../src/posthog'

const realFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = realFetch
})

function stubFetch(
    impl: (url: string, init?: RequestInit) => Promise<Response>,
) {
    const calls: [string, RequestInit | undefined][] = []
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
        calls.push([url, init])
        return impl(url, init)
    }) as typeof fetch
    return calls
}

describe('capture', () => {
    test('sends nothing without a key', async () => {
        const calls = stubFetch(async () => new Response())
        await capture(undefined, 'https://ph.test', 'e', {})
        await capture('', 'https://ph.test', 'e', {})
        expect(calls).toHaveLength(0)
    })
    test('sends an anonymous event', async () => {
        const calls = stubFetch(async () => new Response('ok'))
        await capture('phc_x', 'https://ph.test', 'txv_link_clicked', {
            slug: 'cv',
        })
        const [url, init] = calls[0] ?? []
        expect(url).toBe('https://ph.test/i/v0/e/')
        const body = JSON.parse(String(init?.body))
        expect(body.api_key).toBe('phc_x')
        expect(body.event).toBe('txv_link_clicked')
        expect(body.properties).toMatchObject({
            slug: 'cv',
            source: 'txv.sh',
            $process_person_profile: false,
            $geoip_disable: true,
        })
    })
    test('never throws', async () => {
        const log = spyOn(console, 'error').mockImplementation(() => {})
        stubFetch(async () => {
            throw new Error('offline')
        })
        await capture('k', 'https://ph.test', 'e', {})
        stubFetch(async () => new Response('no', { status: 500 }))
        await capture('k', 'https://ph.test', 'e', {})
        expect(log).toHaveBeenCalledTimes(2)
        log.mockRestore()
    })
})
