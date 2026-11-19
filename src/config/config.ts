import { homedir } from 'node:os'
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
	readonly dataDirectory: string
	readonly quarantineDays: number
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4820
const DEFAULT_QUARANTINE_DAYS = 14
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function readHost(raw: string | undefined): string {
	if (raw === undefined || raw === '') return DEFAULT_HOST
	if (!LOOPBACK_HOSTS.has(raw)) throw new ConfigError(`SCOUR_HOST must be a loopback address (127.0.0.1, localhost or ::1), received "${raw}"`)
	return raw
}

function readInteger(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
	if (raw === undefined || raw === '') return fallback
	const value = Number(raw)
	if (!Number.isInteger(value) || value < min || value > max) throw new ConfigError(`${name} must be an integer from ${min} to ${max}, received "${raw}"`)
	return value
}

function defaultDataDirectory(env: Record<string, string | undefined>): string {
	const home = env['USERPROFILE'] ?? env['HOME'] ?? homedir()
	if (process.platform === 'win32') return join(env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local'), 'scour')
	return join(env['XDG_DATA_HOME'] ?? join(home, '.local', 'share'), 'scour')
}

function orDefault(value: string | undefined, fallback: string): string {
	return value === undefined || value === '' ? fallback : value
}

/**
 * Reads configuration from environment variables. scour has no sign-in, so it
 * only binds to loopback addresses.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
	return {
		host: readHost(env['SCOUR_HOST']),
		port: readInteger('SCOUR_PORT', env['SCOUR_PORT'], DEFAULT_PORT, 1, 65535),
		clientDirectory: orDefault(env['SCOUR_CLIENT_DIRECTORY'], join(process.cwd(), 'dist', 'client')),
		dataDirectory: orDefault(env['SCOUR_DATA_DIRECTORY'], defaultDataDirectory(env)),
		quarantineDays: readInteger('SCOUR_QUARANTINE_DAYS', env['SCOUR_QUARANTINE_DAYS'], DEFAULT_QUARANTINE_DAYS, 1, 365)
	}
}
