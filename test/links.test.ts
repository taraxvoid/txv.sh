import { describe, expect, test } from 'bun:test'
import {
    destinationFor,
    hostMatches,
    linkError,
    slugFromPath,
} from '../src/links'

const hosts = ['taraxvoid.com']
const params = (q = '') => new URLSearchParams(q)

describe('slugFromPath', () => {
    test('normalizes case and slashes', () => {
        expect(slugFromPath('/CV/')).toBe('cv')
        expect(slugFromPath('//gh')).toBe('gh')
    })
    test('rejects anything that is not a slug', () => {
        for (const p of ['/', '/a/b', '/-x', '/x.sh', '/_health', '/%20']) {
            expect(slugFromPath(p)).toBeNull()
        }
        expect(slugFromPath(`/${'a'.repeat(65)}`)).toBeNull()
    })
})

describe('linkError', () => {
    const ok = 'https://taraxvoid.com/resume'
    test('accepts a plain https link', () => {
        expect(linkError('cv', ok, ['verify'])).toBeNull()
    })
    test('rejects bad slugs, script names, non-https and self links', () => {
        expect(linkError('CV', ok, [])).toContain('invalid slug')
        expect(linkError('verify', ok, ['verify'])).toContain('script')
        expect(linkError('cv', 'http://taraxvoid.com', [])).toContain('https')
        expect(linkError('cv', 'not a url', [])).toContain('invalid')
        expect(linkError('cv', 'https://txv.sh/cv', [])).toContain('back at')
        expect(linkError('cv', 'https://www.txv.sh/x', [])).toContain('back at')
    })
})

describe('hostMatches', () => {
    test('matches the host and its subdomains only', () => {
        expect(hostMatches('taraxvoid.com', hosts)).toBe(true)
        expect(hostMatches('status.taraxvoid.com', hosts)).toBe(true)
        expect(hostMatches('nottaraxvoid.com', hosts)).toBe(false)
    })
})

describe('destinationFor', () => {
    test('tags our own hosts with defaults', () => {
        const url = destinationFor(
            'https://taraxvoid.com/resume',
            'cv',
            params(),
            hosts,
        )
        expect(url.searchParams.get('utm_source')).toBe('txv.sh')
        expect(url.searchParams.get('utm_medium')).toBe('shortlink')
        expect(url.searchParams.get('utm_campaign')).toBe('cv')
    })
    test('leaves other hosts untagged', () => {
        const url = destinationFor(
            'https://github.com/taraxvoid',
            'gh',
            params(),
            hosts,
        )
        expect(url.search).toBe('')
    })
    test('stored params beat defaults; the short link beats both', () => {
        const url = destinationFor(
            'https://taraxvoid.com/?utm_campaign=stored&keep=1',
            'cv',
            params('utm_source=meetup&other=dropped'),
            hosts,
        )
        expect(url.searchParams.get('utm_campaign')).toBe('stored')
        expect(url.searchParams.get('utm_source')).toBe('meetup')
        expect(url.searchParams.get('keep')).toBe('1')
        expect(url.searchParams.has('other')).toBe(false)
    })
    test('forwards utm params to untagged hosts too', () => {
        const url = destinationFor(
            'https://github.com/',
            'gh',
            params('utm_term=x'),
            hosts,
        )
        expect(url.searchParams.get('utm_term')).toBe('x')
    })
})
