// SQL for `bun run links`. wrangler d1 execute takes no bind parameters, so
// values are quoted here. linkError() runs first, so slugs are already
// [a-z0-9-] and URLs parse; quoting still covers any string.

export function sqlString(value: string): string {
    if (value.includes('\0')) throw new Error('NUL in SQL string')
    return `'${value.replaceAll("'", "''")}'`
}

const nullable = (value: string | undefined) =>
    value ? sqlString(value) : 'NULL'

export const listSql =
    'SELECT slug, destination_url, note, click_count, last_clicked_at FROM links ORDER BY slug'

export function existsSql(slug: string): string {
    return `SELECT 1 FROM links WHERE slug = ${sqlString(slug)}`
}

export function addSql(slug: string, url: string, note?: string): string {
    return `INSERT INTO links (slug, destination_url, note) VALUES (${sqlString(slug)}, ${sqlString(url)}, ${nullable(note)})`
}

export function setSql(slug: string, url: string, note?: string): string {
    const noteSet = note === undefined ? '' : `, note = ${nullable(note)}`
    return `UPDATE links SET destination_url = ${sqlString(url)}${noteSet} WHERE slug = ${sqlString(slug)}`
}

export function rmSql(slug: string): string {
    return `DELETE FROM links WHERE slug = ${sqlString(slug)}`
}
