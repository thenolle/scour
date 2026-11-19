import { join } from 'node:path'
import { ConfigError, loadConfig } from './config/config'
import { DriveCatalog } from './scanner/drives'
import { ScanManager } from './scanner/manager'
import { createHttpApp } from './server/app'
import { ScanHub } from './server/hub'
import { startServer } from './server/server'
import { APP_NAME } from './shared/meta'

const DRIVE_REFRESH_MS = 30_000

async function main(): Promise<void> {
	const config = loadConfig()
	if (!(await Bun.file(join(config.clientDirectory, 'client.js')).exists())) {
		console.warn(`[${APP_NAME}] browser assets were not found in ${config.clientDirectory}. Run "bun run build" first, or set SCOUR_CLIENT_DIRECTORY.`)
	}

	const drives = new DriveCatalog()
	await drives.refresh()
	const scans = new ScanManager()
	const hub = new ScanHub()
	const unsubscribe = scans.subscribe((event) => hub.publish(event))
	const refresh = setInterval(() => {
		void drives.refresh()
	}, DRIVE_REFRESH_MS)

	const server = startServer(createHttpApp(config, { scans, drives }), { hostname: config.host, port: config.port }, hub)

	let stopping = false
	const stop = (): void => {
		if (stopping) return
		stopping = true
		clearInterval(refresh)
		unsubscribe()
		scans.cancelAll()
		hub.stop()
		void server.stop().then(() => process.exit(0))
	}
	process.on('SIGINT', stop)
	process.on('SIGTERM', stop)

	console.log(`[${APP_NAME}] listening on ${server.url.href}`)
}

main().catch((error: unknown) => {
	if (error instanceof ConfigError) console.error(`[${APP_NAME}] configuration error: ${error.message}`)
	else console.error(`[${APP_NAME}] failed to start`, error)
	process.exit(1)
})
