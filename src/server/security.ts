import type { App } from '@gambrel/core'

type Guard = Parameters<App['use']>[0]

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const TRUSTED_FETCH_SITES = new Set(['same-origin', 'none'])

function refuse(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

function hostnameOf(host: string): string {
  try {
    return new URL(`http://${host}`).hostname
  } catch {
    return ''
  }
}

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Refuses requests whose Host header is not a loopback name. Requests that
 * change state, and WebSocket upgrades, are also refused when the browser
 * says they come from another site (Sec-Fetch-Site) or when a non-empty
 * Origin differs from the host they were sent to. Requests with neither
 * header, such as curl, are allowed. Returns null when the request may proceed.
 */
export function inspectRequest(request: Request, upgrade = false): Response | null {
  const host = request.headers.get('host')
  if (host === null || !LOOPBACK_NAMES.has(hostnameOf(host))) return refuse(421, 'Unexpected host')
  if (!upgrade && SAFE_METHODS.has(request.method.toUpperCase())) return null

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite !== null && fetchSite !== '' && !TRUSTED_FETCH_SITES.has(fetchSite)) {
    return refuse(403, `Cross-origin request refused (sec-fetch-site: ${fetchSite})`)
  }
  const origin = request.headers.get('origin')
  if (origin !== null && origin !== '' && !sameHost(origin, host)) {
    return refuse(403, `Cross-origin request refused (origin: ${origin}, host: ${host})`)
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
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
}
