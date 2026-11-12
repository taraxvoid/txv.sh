import type { Env as LinkEnv } from '@taraxvoid/voidlink'

/** DB (click counts), POSTHOG_KEY (a Worker secret) and POSTHOG_HOST. */
export interface Env extends LinkEnv {}

export const HOST = 'txv.sh'
export const REPO = 'taraxvoid/txv.sh'
