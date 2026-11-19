import { redirect } from '@gambrel/core'
import type { App } from '@gambrel/core'
import { ScanInputError } from '../scanner/manager'
import { summarize } from '../scanner/view'
import { errorResponse, jsonResponse } from './responses'
import type { AppServices } from './services'

async function readPath(request: Request): Promise<string> {
	if ((request.headers.get('content-type') ?? '').includes('application/json')) {
		const body: unknown = await request.json()
		if (typeof body === 'object' && body !== null && 'path' in body && typeof body.path === 'string') return body.path
		return ''
	}
	const form = await request.formData()
	const value = form.get('path')
	return typeof value === 'string' ? value : ''
}

function scanNotFound(): Response {
	return errorResponse(404, 'not_found', 'Scan not found')
}

function scanPage(id: string): Response {
	return redirect(`/scan/${encodeURIComponent(id)}`, 303)
}

/**
 * Registers the JSON API under /api and the form actions under /actions.
 * Form actions redirect back to a page; the API answers with JSON.
 */
export function registerScanRoutes(app: App, services: AppServices): void {
	const { scans, drives } = services

	app.get('/api/drives', async () => {
		await drives.refresh()
		return jsonResponse({ data: drives.snapshot() })
	})

	app.get('/api/scans', () => jsonResponse({ data: scans.list().map(summarize) }))

	app.post('/api/scans', async (context) => {
		const session = await scans.start(await readPath(context.request))
		return jsonResponse({ data: summarize(session) }, 201)
	})

	app.get('/api/scans/:id', (context) => {
		const session = scans.get(context.params.id)
		return session === undefined ? scanNotFound() : jsonResponse({ data: summarize(session) })
	})

	app.delete('/api/scans/:id', (context) => {
		if (scans.get(context.params.id) === undefined) return scanNotFound()
		scans.cancel(context.params.id)
		return jsonResponse({ data: { cancelled: true } })
	})

	app.post('/api/scans/:id/duplicates', (context) => {
		const session = scans.get(context.params.id)
		if (session === undefined) return scanNotFound()
		if (!scans.startDuplicates(session.id)) return errorResponse(409, 'not_available', 'Duplicates can be searched after a scan completes, and only one search can run at a time')
		return jsonResponse({ data: summarize(session) }, 202)
	})

	app.post('/actions/scan', async (context) => {
		try {
			const session = await scans.start(await readPath(context.request))
			return scanPage(session.id)
		} catch (error) {
			if (error instanceof ScanInputError) return redirect(`/?error=${encodeURIComponent(error.message)}`, 303)
			throw error
		}
	})

	app.post('/actions/scan/:id/cancel', (context) => {
		scans.cancel(context.params.id)
		return scanPage(context.params.id)
	})

	app.post('/actions/scan/:id/duplicates', (context) => {
		scans.startDuplicates(context.params.id)
		return scanPage(context.params.id)
	})
}
