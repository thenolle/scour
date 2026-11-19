import type { App } from '@gambrel/core'
import type { ScanHub } from './hub'
import { inspectRequest } from './security'

const MAX_REQUEST_BODY_BYTES = 64 * 1024
const MAX_SOCKET_MESSAGE_BYTES = 1024
const SOCKET_PATH = '/ws'

export interface ServerOptions {
	readonly hostname: string
	readonly port: number
}

export interface RunningServer {
	readonly url: URL
	/** Stops listening and closes open connections. */
	stop(): Promise<void>
}

/**
 * Serves the application with `Bun.serve` and upgrades `/ws` to a WebSocket
 * that streams scan events. Sockets are read-only: messages from clients are
 * ignored and limited to 1 KiB.
 */
export function startServer(app: Pick<App, 'fetch'>, options: ServerOptions, hub: ScanHub): RunningServer {
	const server = Bun.serve({
		hostname: options.hostname,
		port: options.port,
		maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
		fetch(request, bunServer) {
			if (new URL(request.url).pathname === SOCKET_PATH) {
				const rejection = inspectRequest(request, true)
				if (rejection !== null) return rejection
				if (hub.full) return new Response('Too many connections', { status: 503 })
				if (bunServer.upgrade(request)) return undefined
				return new Response('Expected a WebSocket upgrade', { status: 426 })
			}
			return app.fetch(request)
		},
		websocket: {
			maxPayloadLength: MAX_SOCKET_MESSAGE_BYTES,
			open(socket) {
				hub.add(socket)
			},
			close(socket) {
				hub.remove(socket)
			},
			message() {
				return undefined
			}
		}
	})
	return {
		url: server.url,
		stop: () => server.stop(true)
	}
}
