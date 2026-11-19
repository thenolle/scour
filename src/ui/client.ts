import { hydrateRoutes } from '@gambrel/browser'
import { components, routes } from '../../.gambrel/manifest.client'
import { startLive } from './live'

try {
	hydrateRoutes({ routes, components })
} catch (error) {
	console.error('[scour] hydration failed; the server-rendered page stays as it is', error)
}
startLive()
