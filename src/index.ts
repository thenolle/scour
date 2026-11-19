import { join } from 'node:path'
import { CleanerManager } from './cleaner/manager'
import { resolveEnvironment } from './cleaner/rules'
import { Vault } from './cleaner/vault'
import { ConfigError, loadConfig } from './config/config'
import { DriveCatalog } from './scanner/drives'
import { ScanManager } from './scanner/manager'
import { createHttpApp } from './server/app'
import { ScanHub } from './server/hub'
import { startServer } from './server/server'
import { APP_NAME } from './shared/meta'
import { UninstallManager } from './uninstaller/manager'
import { RegistrySurgeon } from './uninstaller/registry'

const DRIVE_REFRESH_MS = 30_000
const PURGE_INTERVAL_MS = 60 * 60 * 1000

async function main(): Promise<void> {
  const config = loadConfig()
  if (!(await Bun.file(join(config.clientDirectory, 'client.js')).exists())) {
    console.warn(`[${APP_NAME}] browser assets were not found in ${config.clientDirectory}. Run "bun run build" first, or set SCOUR_CLIENT_DIRECTORY.`)
  }

  const drives = new DriveCatalog()
  await drives.refresh()
  const scans = new ScanManager()
  const vault = new Vault(config.dataDirectory, config.quarantineDays)
  await vault.load(drives.snapshot().map((drive) => drive.path))
  const cleaner = new CleanerManager(resolveEnvironment(), vault, scans)

  const hub = new ScanHub()
  const surgeon = new RegistrySurgeon(join(config.dataDirectory, 'registry-backups'))
  await surgeon.load()
  const uninstaller = new UninstallManager(surgeon, vault, (event) => hub.publish(event))
  try {
    await uninstaller.refresh()
  } catch (error) {
    console.warn(`[${APP_NAME}] ${error instanceof Error ? error.message : String(error)}`)
  }

  const unsubscribe = scans.subscribe((event) => hub.publish(event))
  const refresh = setInterval(() => {
    void drives.refresh()
  }, DRIVE_REFRESH_MS)

  const purge = async (): Promise<void> => {
    try {
      const purged = await cleaner.purgeExpired()
      if (purged > 0) console.log(`[${APP_NAME}] deleted ${purged} expired quarantine ${purged === 1 ? 'batch' : 'batches'}`)
    } catch (error) {
      console.error(`[${APP_NAME}] quarantine purge failed`, error)
    }
  }
  await purge()
  const purgeTimer = setInterval(() => {
    void purge()
  }, PURGE_INTERVAL_MS)

  const server = startServer(createHttpApp(config, { scans, drives, cleaner, uninstaller }), { hostname: config.host, port: config.port }, hub)

  let stopping = false
  const stop = (): void => {
    if (stopping) return
    stopping = true
    clearInterval(refresh)
    clearInterval(purgeTimer)
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
