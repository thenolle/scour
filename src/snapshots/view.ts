import type { ActionReport } from '../shared/cleaner-view'
import type { CompareView, DiffView, SnapshotDetailView, SnapshotListView, SnapshotSummary } from '../shared/snapshot-view'
import type { SnapshotManager, StoredDiff } from './manager'
import type { SnapshotMeta } from './store'

const MAX_ITEMS = 500

function toSummary(meta: SnapshotMeta): SnapshotSummary {
  return { id: meta.id, name: meta.name, createdAt: meta.createdAt, status: meta.status, files: meta.files, keys: meta.keys, error: meta.error }
}

function removableFirst(a: { readonly removable: boolean }, b: { readonly removable: boolean }): number {
  return Number(b.removable) - Number(a.removable)
}

function toDiffView(diff: StoredDiff): DiffView {
  const files = [...diff.files].sort(removableFirst)
  const keys = [...diff.keys].sort(removableFirst)
  return {
    comparedAt: diff.comparedAt,
    totals: diff.totals,
    files: files.slice(0, MAX_ITEMS),
    keys: keys.slice(0, MAX_ITEMS),
    hiddenFiles: Math.max(0, files.length - MAX_ITEMS),
    hiddenKeys: Math.max(0, keys.length - MAX_ITEMS),
    removableFiles: files.filter((item) => item.removable).length,
    removableKeys: keys.filter((item) => item.removable).length,
    modifiedSample: diff.modifiedSample
  }
}

export function buildSnapshotListView(manager: SnapshotManager, report: ActionReport | null): SnapshotListView {
  return { snapshots: manager.list().map(toSummary), report }
}

export function buildSnapshotDetailView(manager: SnapshotManager, id: string, report: ActionReport | null): SnapshotDetailView | null {
  const meta = manager.get(id)
  if (meta === undefined) return null
  const state = manager.comparison(id)
  const compare: CompareView | null = state === undefined ? null : { status: state.status, error: state.error, diff: state.diff === null ? null : toDiffView(state.diff) }
  return { snapshot: toSummary(meta), compare, busy: manager.isBusy(id), report }
}
