import type { DriveCatalog } from '../scanner/drives'
import type { ScanManager } from '../scanner/manager'

export interface AppServices {
  readonly scans: ScanManager
  readonly drives: DriveCatalog
}
