import { describe, expect, test } from 'bun:test'
import { isBotUserAgent } from '../src/bot'

describe('isBotUserAgent', () => {
    test('missing user-agent is a bot', () => {
        for (const ua of [undefined, null, '']) {
            expect(isBotUserAgent(ua)).toBe(true)
        }
    })
    test('flags link previews, crawlers and HTTP clients', () => {
        for (const ua of [
            'Slackbot-LinkExpanding 1.0',
            'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
            'facebookexternalhit/1.1',
            'WhatsApp/2.23.20.0 A',
            'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'curl/8.4.0',
            'Wget/1.21.4',
            'python-requests/2.32.0',
        ]) {
            expect(isBotUserAgent(ua)).toBe(true)
        }
    })
    test('passes ordinary browsers', () => {
        for (const ua of [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
        ]) {
            expect(isBotUserAgent(ua)).toBe(false)
        }
    })
})
