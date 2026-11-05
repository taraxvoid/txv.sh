import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { SCRIPTS } from '../src/scripts'

type Manager = { managerFilePatterns: string[]; matchStrings: string[] }

const config = JSON.parse(readFileSync('renovate.json', 'utf8')) as {
    customManagers: Manager[]
}

/** What Renovate's regex managers would extract from sh/<name>.sh. */
function extract(name: string): Record<string, string>[] {
    const path = `sh/${name}.sh`
    const text = SCRIPTS[name] ?? ''
    return config.customManagers
        .filter((m) =>
            m.managerFilePatterns.some((p) =>
                new RegExp(p.slice(1, -1)).test(path),
            ),
        )
        .flatMap((m) =>
            m.matchStrings.flatMap((s) =>
                [...text.matchAll(new RegExp(s, 'g'))].map((x) => ({
                    ...x.groups,
                })),
            ),
        )
}

describe('renovate', () => {
    test('bumps the voidflow pin in sh/voidflow.sh', () => {
        const deps = extract('voidflow')
        expect(deps).toHaveLength(1)
        expect(deps[0]).toMatchObject({
            datasource: 'npm',
            depName: '@taraxvoid/voidflow',
        })
        expect(deps[0]?.currentValue).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/)
    })
    test('every `# renovate:` comment in sh/ is picked up', () => {
        for (const [name, text] of Object.entries(SCRIPTS)) {
            const comments = text.match(/# renovate:/g)?.length ?? 0
            expect(extract(name)).toHaveLength(comments)
        }
    })
})
