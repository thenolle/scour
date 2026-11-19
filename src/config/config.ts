import { join } from 'node:path'

export class ConfigError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ConfigError'
	}
}

export interface Config {
	readonly host: string
	readonly port: number
	readonly clientDirectory: string
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4820
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function readHost(raw: string | undefined): string {
	if (raw === undefined || raw === '') return DEFAULT_HOST
	if (!LOOPBACK_HOSTS.has(raw)) throw new ConfigError(`SCOUR_HOST must be a loopback address (127.0.0.1, localhost or ::1), received "${raw}"`)
	return raw
}

function readPort(raw: string | undefined): number {
	if (raw === undefined || raw === '') return DEFAULT_PORT
	const port = Number(raw)
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError(`SCOUR_PORT must be an integer from 1 to 65535, received "${raw}"`)
	return port
}

/**
 * Reads configuration from environment variables. scour has no sign-in, so it
 * only binds to loopback addresses.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
	const clientDirectory = env['SCOUR_CLIENT_DIRECTORY']
	return {
		host: readHost(env['SCOUR_HOST']),
		port: readPort(env['SCOUR_PORT']),
		clientDirectory: clientDirectory === undefined || clientDirectory === '' ? join(process.cwd(), 'dist', 'client') : clientDirectory
	}
}
