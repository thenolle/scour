import { staticFiles } from '@gambrel/bun'
import { createApp, json } from '@gambrel/core'
import type { App } from '@gambrel/core'
import { createDocumentHandler } from '@gambrel/ssr'
import { components, hooks, routes } from '../../.gambrel/manifest.server'
import type { Config } from '../config/config'
import { collectHealth } from '../shared/meta'
import type { PageContext } from '../ui/context.server'

function apiNotFound(): Response {
	return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }), {
		status: 404,
		headers: { 'content-type': 'application/json; charset=utf-8' }
	})
}

/**
 * Builds the HTTP application. Explicit routes (health, assets) win; every
 * other URL goes to the Gambrel document handler, which renders file-routed
 * pages and error documents.
 */
export function createHttpApp(config: Config): App {
	const documents = createDocumentHandler<PageContext>({
		routes,
		components,
		hooks,
		entry: '/assets/client.js',
		development: process.env['NODE_ENV'] === 'development'
	})
	const app = createApp()
	app.use(staticFiles({ directory: config.clientDirectory, prefix: '/assets' }))
	app.get('/api/health', () => json({ data: collectHealth() }))
	app.notFound((context) => (context.url.pathname.startsWith('/api/') ? apiNotFound() : documents.handle(context.request, { ...context, info: collectHealth() })))
	return app
}
