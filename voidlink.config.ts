import { defineSite } from '@taraxvoid/voidlink'
import { SCRIPTS } from './src/scripts'

/**
 * txv.sh's voidlink settings. The links themselves are in taraxvoid/infra's
 * redirects.ts (private), and CI bundles them at deploy time.
 */
export default defineSite({
    host: 'txv.sh',
    homeUrl: 'https://taraxvoid.com/',
    title: 'txv.sh',
    description:
        'Short links from Tara X Void. For install scripts: curl txv.sh',
    // Destinations on these hosts (or their subdomains) get default utm_ tags,
    // so the site's own analytics credits txv.sh.
    utmHosts: ['taraxvoid.com', 'taraxvoid.net'],
    // A script in sh/ owns its name: no link may take it.
    reserved: Object.keys(SCRIPTS),
    analytics: { event: 'txv_link_clicked' },
})
