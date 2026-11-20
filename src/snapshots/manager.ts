import { basename } from 'node:path'
import type { Candidate } from '../cleaner/detect'
import { CleanerError, describe } from '../cleaner/errors'
import { assertSafeTarget } from '../cleaner/vault'
import type { Vault } from '../cleaner/vault'
import type { ActionReport } from '../shared/cleaner-view'
import type { ScanEvent } from '../shared/events'
import type { JobStatus } from '../shared/program-view'
import type { DiffTotals } from '../shared/snapshot-view'
import { hashId, isProtectedName } from '../uninstaller/names'
import { assertSafeKey } from '../uninstaller/registry'
import type { RegistrySurgeon } from '../uninstaller/registry'
import { captureSnapshot, compareSnapshot } from './engine'
import type { DiffResult } from './engine'
import { SnapshotStore } from './store'
import type { SnapshotMeta } from './store'

export interface FileTarget {
  readonly id: string
  readonly path: string
  readonly kind: 'file' | 'dir'
  readonly bytes: number
  readonly files: number
  readonly removable: boolean
}

export interface KeyTarget {
  readonly id: string
  readonly key: string
  readonly removable: boolean
}

export interface StoredDiff {
  readonly comparedAt: number
  readonly totals: DiffTotals
  readonly modifiedSample: readonly string[]
  files: FileTarget[]
  keys: KeyTarget[]
}

export interface Comparison {
  status: JobStatus
  error: string | null
  diff: StoredDiff | null
}

function canRemoveFile(path: string): boolean {
  try {
    assertSafeTarget(path)
    return !isProtectedName(basename(path))
  } catch {
    return false
  }
}

function canRemoveKey(key: string): boolean {
  try {
    assertSafeKey(key, true)
    return true
  } catch {
    return false
  }
}

function toCandidate(meta: SnapshotMeta, file: FileTarget): Candidate {
  return { id: file.id, ruleId: 'snapshot', group: 'Install', title: `${meta.name}: ${basename(file.path)}`, path: file.path, risk: 'review', bytes: file.bytes, files: file.files, note: 'Added since the snapshot' }
}

/** Takes snapshots, compares them with the current system, and removes what an install added. */
export class SnapshotManager {
  private readonly metas = new Map<string, SnapshotMeta>()
  private readonly comparisons = new Map<string, Comparison>()
  private readonly controller = new AbortController()
  private active: string | null = null
  private report: ActionReport | null = null

  constructor(
    private readonly store: SnapshotStore,
    private readonly vault: Vault,
    private readonly surgeon: RegistrySurgeon,
    private readonly roots: readonly string[],
    private readonly excluded: readonly string[],
    private readonly publish: (event: ScanEvent) => void
  ) {}

  async load(): Promise<void> {
    this.metas.clear()
    for (const meta of await this.store.list()) this.metas.set(meta.id, meta)
  }

  stop(): void {
    this.controller.abort()
  }

  list(): SnapshotMeta[] {
    return [...this.metas.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  get(id: string): SnapshotMeta | undefined {
    return this.metas.get(id)
  }

  comparison(id: string): Comparison | undefined {
    return this.comparisons.get(id)
  }

  isBusy(id: string): boolean {
    return this.active === id
  }

  takeReport(): ActionReport | null {
    const report = this.report
    this.report = null
    return report
  }

  fail(message: string): void {
    this.report = { kind: 'error', message, failures: [] }
  }

  async create(name: string): Promise<SnapshotMeta> {
    const clean = name.trim()
    if (clean === '' || clean.length > 80) throw new CleanerError('Give the snapshot a name of up to 80 characters.')
    const meta: SnapshotMeta = { version: 1, id: crypto.randomUUID(), name: clean, createdAt: Date.now(), status: 'running', files: 0, keys: 0, error: null }
    this.claim(meta.id)
    try {
      await this.store.create(meta)
    } catch (error) {
      this.active = null
      throw new CleanerError(`Could not create the snapshot: ${describe(error)}`)
    }
    this.metas.set(meta.id, meta)
    this.publish({ type: 'job', id: meta.id, status: 'running' })
    void this.runCapture(meta)
    return meta
  }

  compare(id: string): void {
    const meta = this.require(id)
    if (meta.status !== 'ready') throw new CleanerError('That snapshot is not ready.')
    this.claim(id)
    this.comparisons.set(id, { status: 'running', error: null, diff: null })
    this.publish({ type: 'job', id, status: 'running' })
    void this.runCompare(meta)
  }

  async delete(id: string): Promise<void> {
    this.require(id)
    if (this.active === id) throw new CleanerError('Wait for the running operation to finish.')
    await this.store.remove(id)
    this.metas.delete(id)
    this.comparisons.delete(id)
    this.report = { kind: 'ok', message: 'Deleted the snapshot.', failures: [] }
  }

  async removeAdded(id: string, selected: readonly string[], all: boolean): Promise<void> {
    const meta = this.require(id)
    const diff = this.comparisons.get(id)?.diff ?? null
    if (diff === null) throw new CleanerError('Compare the snapshot with the current system first.')
    const wanted = new Set(selected)
    const pick = (item: { readonly id: string; readonly removable: boolean }): boolean => item.removable && (all || wanted.has(item.id))
    const files = diff.files.filter(pick)
    const keys = diff.keys.filter(pick)
    if (files.length + keys.length === 0) throw new CleanerError('Select at least one item.')

    this.claim(id)
    try {
      const failures: string[] = []
      let moved = 0
      let deleted = 0
      if (files.length > 0) {
        const result = await this.vault.quarantine(files.map((file) => toCandidate(meta, file)))
        moved = result.moved.length
        failures.push(...result.failed.map((failure) => `${failure.path}: ${failure.message}`))
        const done = new Set(result.moved.map((item) => item.originalPath))
        diff.files = diff.files.filter((file) => !done.has(file.path))
      }
      if (keys.length > 0) {
        const result = await this.surgeon.removeKeys(`Snapshot: ${meta.name}`, keys.map((item) => item.key), true)
        deleted = result.deleted.length
        failures.push(...result.failed.map((failure) => `${failure.key}: ${failure.message}`))
        const gone = new Set(result.deleted)
        diff.keys = diff.keys.filter((item) => !gone.has(item.key))
      }
      this.report = {
        kind: moved + deleted > 0 ? 'ok' : 'error',
        message: `Moved ${moved} ${moved === 1 ? 'item' : 'items'} to quarantine and removed ${deleted} registry ${deleted === 1 ? 'key' : 'keys'}. Registry keys were exported first; restore them from the backups on the programs page.`,
        failures
      }
    } finally {
      this.active = null
    }
  }

  private require(id: string): SnapshotMeta {
    const meta = this.metas.get(id)
    if (meta === undefined) throw new CleanerError('Unknown snapshot.')
    return meta
  }

  private claim(id: string): void {
    if (this.active !== null) throw new CleanerError('Another snapshot operation is still running.')
    this.active = id
  }

  private decorate(id: string, result: DiffResult): StoredDiff {
    return {
      comparedAt: result.comparedAt,
      totals: result.totals,
      modifiedSample: result.modifiedSample,
      files: result.files.map((item) => ({ id: hashId(id, item.path), path: item.path, kind: item.kind, bytes: item.bytes, files: item.files, removable: canRemoveFile(item.path) })),
      keys: result.keys.map((key) => ({ id: hashId(id, key), key, removable: canRemoveKey(key) }))
    }
  }

  private async runCapture(meta: SnapshotMeta): Promise<void> {
    try {
      const counts = await captureSnapshot(this.store, meta.id, this.roots, this.excluded, this.controller.signal)
      meta.files = counts.files
      meta.keys = counts.keys
      meta.status = 'ready'
    } catch (error) {
      meta.status = 'failed'
      meta.error = describe(error)
    }
    try {
      await this.store.writeMeta(meta)
    } catch (error) {
      console.error('[scour] could not save snapshot metadata', error)
    }
    this.active = null
    this.publish({ type: 'job', id: meta.id, status: meta.status === 'ready' ? 'completed' : 'failed' })
  }

  private async runCompare(meta: SnapshotMeta): Promise<void> {
    const comparison: Comparison = { status: 'running', error: null, diff: null }
    this.comparisons.set(meta.id, comparison)
    try {
      comparison.diff = this.decorate(meta.id, await compareSnapshot(this.store, meta.id, this.roots, this.excluded, this.controller.signal))
      comparison.status = 'completed'
    } catch (error) {
      comparison.status = 'failed'
      comparison.error = describe(error)
    }
    this.active = null
    this.publish({ type: 'job', id: meta.id, status: comparison.status })
  }
}

export function createSnapshotStore(directory: string): SnapshotStore {
  return new SnapshotStore(directory)
}
