import { describe, expect, test } from 'bun:test'
import { addSql, rmSql, setSql, sqlString } from '../scripts/link-sql'
import { testD1 } from './d1'

describe('link SQL', () => {
    test('quotes strings', () => {
        expect(sqlString("it's")).toBe("'it''s'")
        expect(() => sqlString('a\0b')).toThrow()
    })
    test('round-trips awkward values through sqlite', () => {
        const { sqlite } = testD1()
        const url = "https://taraxvoid.com/?q=a'b;--"
        sqlite.run(addSql('cv', url, "Tara's resume"))
        const row = sqlite.query('SELECT * FROM links').get() as Record<
            string,
            unknown
        >
        expect(row.destination_url).toBe(url)
        expect(row.note).toBe("Tara's resume")
        sqlite.run(setSql('cv', 'https://taraxvoid.com/'))
        const kept = sqlite.query('SELECT note FROM links').get() as {
            note: string
        }
        expect(kept.note).toBe("Tara's resume")
        sqlite.run(rmSql('cv'))
        expect(sqlite.query('SELECT * FROM links').all()).toHaveLength(0)
    })
})
