export interface Env {
    DB: D1Database
    /** PostHog project key, a Worker secret. Unset: no analytics. */
    POSTHOG_KEY?: string
    POSTHOG_HOST: string
    /** Where `/` and unknown links send browsers. */
    HOME_URL: string
    /** Destination hosts (and their subdomains) that get default utm_ tags. */
    UTM_HOSTS: string[]
}

export const HOST = 'txv.sh'
export const REPO = 'taraxvoid/txv.sh'
