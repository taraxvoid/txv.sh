import { createWorker } from '@taraxvoid/voidlink'
import site from '../voidlink.config'
import type { Env } from './config'
import { routes } from './routes'

export default createWorker<Env>({ site, routes })
