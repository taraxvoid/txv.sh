// The checked links `voidlink build` writes to links.gen.json (gitignored),
// mapped to this name by wrangler.jsonc's `alias`. CI builds it from
// taraxvoid/infra's redirects.ts; `bun run links:empty` makes an empty one.
declare module 'voidlink:links' {
    const links: import('@taraxvoid/voidlink').LinkTable
    export default links
}
