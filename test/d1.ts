import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'

const MIGRATIONS = `${import.meta.dir}/../migrations`

/**
 * Just enough of D1's prepared-statement API (bind/first/all/run) for the
 * Worker, over bun:sqlite with the real migrations applied, so the schema
 * isn't written out twice.
 */
export function testD1(): D1Database & { sqlite: Database } {
    const sqlite = new Database(':memory:')
    for (const file of readdirSync(MIGRATIONS).sort()) {
        if (file.endsWith('.sql')) {
            sqlite.run(readFileSync(`${MIGRATIONS}/${file}`, 'utf8'))
        }
    }
    const statement = (query: string, params: unknown[]) => {
        const stmt = sqlite.query(query)
        const args = params as never[]
        return {
            bind: (...next: unknown[]) => statement(query, next),
            first: async (column?: string) => {
                const row = stmt.get(...args) as Record<string, unknown> | null
                if (!row) return null
                return column ? (row[column] ?? null) : row
            },
            all: async () => ({ results: stmt.all(...args), success: true }),
            run: async () => {
                const { changes } = stmt.run(...args)
                return { success: true, meta: { changes } }
            },
        }
    }
    return {
        sqlite,
        prepare: (query: string) => statement(query, []),
    } as unknown as D1Database & { sqlite: Database }
}

export function seedLink(db: D1Database, slug: string, url: string) {
    return db
        .prepare('INSERT INTO links (slug, destination_url) VALUES (?, ?)')
        .bind(slug, url)
        .run()
}
