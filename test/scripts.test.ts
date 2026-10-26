import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { SCRIPTS, scriptRoute, sha256, summary } from '../src/scripts'

const files = readdirSync('sh').filter((f) => f.endsWith('.sh'))

describe('scripts', () => {
    test('every file in sh/ is registered, and nothing else', () => {
        expect(Object.keys(SCRIPTS).sort()).toEqual(
            files.map((f) => f.slice(0, -3)).sort(),
        )
    })
    test('served bytes hash to the file on disk (what CI attests)', async () => {
        for (const f of files) {
            const disk = createHash('sha256')
                .update(readFileSync(`sh/${f}`))
                .digest('hex')
            expect(await sha256(SCRIPTS[f.slice(0, -3)] ?? '')).toBe(disk)
        }
    })
    test('every script has a shebang and a summary line', () => {
        for (const text of Object.values(SCRIPTS)) {
            expect(text.startsWith('#!/bin/sh\n')).toBe(true)
            expect(summary(text)).not.toBe('')
        }
    })
    test('routes', () => {
        expect(scriptRoute('/verify')).toEqual({
            name: 'verify',
            checksum: false,
        })
        expect(scriptRoute('/verify.sh')).toEqual({
            name: 'verify',
            checksum: false,
        })
        expect(scriptRoute('/verify.sha256')).toEqual({
            name: 'verify',
            checksum: true,
        })
        expect(scriptRoute('/nope')).toBeNull()
        expect(scriptRoute('/toString')).toBeNull()
        expect(scriptRoute('/constructor')).toBeNull()
    })
})
