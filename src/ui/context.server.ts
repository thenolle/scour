import type { Context } from '@gambrel/core'
import type { CleanerManager } from '../cleaner/manager'
import type { DriveCatalog } from '../scanner/drives'
import type { ScanManager } from '../scanner/manager'
import type { SnapshotManager } from '../snapshots/manager'
import type { UninstallManager } from '../uninstaller/manager'

/** What page guards and loaders receive. */
export interface PageContext extends Context {
  readonly scans: ScanManager
  readonly drives: DriveCatalog
  readonly cleaner: CleanerManager
  readonly uninstaller: UninstallManager
  readonly snapshots: SnapshotManager
}
