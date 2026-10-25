import { handle } from './app'
import type { Env } from './config'

export default {
    async fetch(req, env, ctx) {
        try {
            return await handle(req, env, ctx)
        } catch (err) {
            console.error(err)
            return new Response('internal error\n', { status: 500 })
        }
    },
} satisfies ExportedHandler<Env>
