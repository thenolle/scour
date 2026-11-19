import { staticFiles } from '@gambrel/bun'
import { createApp, json, redirect } from '@gambrel/core'
import type { App } from '@gambrel/core'
import { createDocumentHandler } from '@gambrel/ssr'
import { components, hooks, routes } from '../../.gambrel/manifest.server'
import type { Config } from '../config/config'
import { ScanInputError } from '../scanner/manager'
import { collectHealth } from '../shared/meta'
import type { PageContext } from '../ui/context.server'
import { registerScanRoutes } from './api'
import { errorResponse } from './responses'
import { requestGuard } from './security'
import type { AppServices } from './services'

function handleError(error: unknown): Response {
	if (error instanceof ScanInputError || error instanceof SyntaxError) return errorResponse(400, 'bad_request', error.message)
	console.error(error)
	return errorResponse(500, 'internal_error', 'Internal Server Error')
}

/**
 * Builds the HTTP application. The request guard wraps everything. Explicit
 * routes (assets, health, API, form actions) win; every other URL goes to the
 * Gambrel document handler, which renders file-routed pages and error pages.
 */
export function createHttpApp(config: Config, services: AppServices): App {
	const documents = createDocumentHandler<PageContext>({
		routes,
		components,
		hooks,
		entry: '/assets/client.js',
		development: process.env['NODE_ENV'] === 'development'
	})
	const app = createApp()
	app.use(requestGuard())
	app.use(staticFiles({ directory: config.clientDirectory, prefix: '/assets' }))
	app.get('/favicon.ico', () => redirect('/assets/favicon.svg', 302))
	app.get('/api/health', () => json({ data: collectHealth() }))
	registerScanRoutes(app, services)
	app.notFound((context) => context.url.pathname.startsWith('/api/') ? errorResponse(404, 'not_found', 'Not found') : documents.handle(context.request, { ...context, scans: services.scans, drives: services.drives }))
	app.onError(handleError)
	return app
}
