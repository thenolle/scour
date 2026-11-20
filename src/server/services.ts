import type { CleanerManager } from '../cleaner/manager'
import type { DriveCatalog } from '../scanner/drives'
import type { ScanManager } from '../scanner/manager'
import type { SnapshotManager } from '../snapshots/manager'
import type { UninstallManager } from '../uninstaller/manager'

export interface AppServices {
  readonly scans: ScanManager
  readonly drives: DriveCatalog
  readonly cleaner: CleanerManager
  readonly uninstaller: UninstallManager
  readonly snapshots: SnapshotManager
}
