import type { App } from '@gambrel/core'

type Guard = Parameters<App['use']>[0]

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function refuse(status: number, message: string): Response {
	return new Response(message, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	})
}

function parseUrl(value: string): URL | null {
	try {
		return new URL(value)
	} catch {
		return null
	}
}

function hostnameOf(host: string): string {
	return parseUrl(`http://${host}`)?.hostname.toLowerCase() ?? ''
}

function sameHost(origin: string, host: string, requestUrl: string): boolean {
	const originUrl = parseUrl(origin)
	const targetUrl = parseUrl(requestUrl)
	const hostUrl = parseUrl(`http://${host}`)
	if (originUrl === null || targetUrl === null || hostUrl === null) return false
	const originHost = originUrl.hostname.toLowerCase()
	const requestHost = hostUrl.hostname.toLowerCase()
	const isLoopbackAlias = LOOPBACK_NAMES.has(originHost) && LOOPBACK_NAMES.has(requestHost)
	const hostnameMatches = originHost === requestHost || isLoopbackAlias
	const portMatches = originUrl.port === targetUrl.port
	const protocolMatches = originUrl.protocol === targetUrl.protocol
	return hostnameMatches && portMatches && protocolMatches
}

/**
 * Refuses requests whose Host header is not a loopback name, and refuses
 * state-changing requests and WebSocket upgrades whose Origin differs
 * from the host and protocol they were sent to.
 */
export function inspectRequest(request: Request, upgrade = false): Response | null {
	const host = request.headers.get('host')
	if (host === null || !LOOPBACK_NAMES.has(hostnameOf(host))) return refuse(421, 'Unexpected host')
	const method = request.method.toUpperCase()
	const changesState = upgrade || !SAFE_METHODS.has(method)
	if (changesState) {
		const origin = request.headers.get('origin')
		const fetchSite = request.headers.get('sec-fetch-site')
		if (origin !== null && origin !== 'null') {
			if (!sameHost(origin, host, request.url)) return refuse(403, 'Cross-origin request refused')
		} else if (fetchSite !== 'same-origin') {
			return refuse(403, 'Cross-origin request refused')
		}
	}
	return null
}

/** Applies the request checks and adds basic security headers to every response. */
export function requestGuard(): Guard {
	return async (context, next) => {
		const rejection = inspectRequest(context.request)
		if (rejection !== null) return rejection
		const response = await next()
		const headers = new Headers(response.headers)
		headers.set('x-content-type-options', 'nosniff')
		headers.set('referrer-policy', 'no-referrer')
		headers.set('x-frame-options', 'DENY')
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		})
	}
}
