import { join } from 'node:path'
import { ConfigError, loadConfig } from './config/config'
import { createHttpApp } from './server/app'
import { APP_NAME } from './shared/meta'

async function main(): Promise<void> {
	const config = loadConfig()
	if (!(await Bun.file(join(config.clientDirectory, 'client.js')).exists())) console.warn(`[${APP_NAME}] browser assets were not found in ${config.clientDirectory}. Run "bun run build" first, or set SCOUR_CLIENT_DIRECTORY.`)
	const app = createHttpApp(config)
	const server = Bun.serve({ hostname: config.host, port: config.port, fetch: (request) => app.fetch(request) })
	const stop = (): void => { void server.stop(true).then(() => process.exit(0)) }
	process.on('SIGINT', stop)
	process.on('SIGTERM', stop)
	console.log(`[${APP_NAME}] listening on ${server.url.href}`)
}

main().catch((error: unknown) => {
	if (error instanceof ConfigError) console.error(`[${APP_NAME}] configuration error: ${error.message}`)
	else console.error(`[${APP_NAME}] failed to start`, error)
	process.exit(1)
})
