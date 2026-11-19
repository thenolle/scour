import type { Context } from '@gambrel/core'
import type { DriveCatalog } from '../scanner/drives'
import type { ScanManager } from '../scanner/manager'

/** What page guards and loaders receive. */
export interface PageContext extends Context {
  readonly scans: ScanManager
  readonly drives: DriveCatalog
}
