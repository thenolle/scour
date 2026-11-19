import type { Context } from '@gambrel/core'
import type { HealthInfo } from '../shared/meta'

/** What page guards and loaders receive. */
export interface PageContext extends Context {
	readonly info: HealthInfo
}
