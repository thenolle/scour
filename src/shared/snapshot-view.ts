import type { ActionReport } from './cleaner-view'
import type { JobStatus } from './program-view'

export type SnapshotStatus = 'running' | 'ready' | 'failed'

export type SnapshotSummary = {
  readonly id: string
  readonly name: string
  readonly createdAt: number
  readonly status: SnapshotStatus
  readonly files: number
  readonly keys: number
  readonly error: string | null
}

export type SnapshotListView = {
  readonly snapshots: readonly SnapshotSummary[]
  readonly report: ActionReport | null
}

export type DiffTotals = {
  readonly addedFiles: number
  readonly addedBytes: number
  readonly addedKeys: number
  readonly modifiedFiles: number
  readonly modifiedKeys: number
  readonly removedEntries: number
}

export type DiffFileItem = {
  readonly id: string
  readonly path: string
  readonly kind: 'file' | 'dir'
  readonly bytes: number
  readonly files: number
  readonly removable: boolean
}

export type DiffKeyItem = {
  readonly id: string
  readonly key: string
  readonly removable: boolean
}

export type DiffView = {
  readonly comparedAt: number
  readonly totals: DiffTotals
  readonly files: readonly DiffFileItem[]
  readonly keys: readonly DiffKeyItem[]
  readonly hiddenFiles: number
  readonly hiddenKeys: number
  readonly removableFiles: number
  readonly removableKeys: number
  readonly modifiedSample: readonly string[]
}

export type CompareView = {
  readonly status: JobStatus
  readonly error: string | null
  readonly diff: DiffView | null
}

export type SnapshotDetailView = {
  readonly snapshot: SnapshotSummary
  readonly compare: CompareView | null
  readonly busy: boolean
  readonly report: ActionReport | null
}