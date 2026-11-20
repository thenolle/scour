import { dirname } from 'node:path'
import type { DiffTotals } from '../shared/snapshot-view'
import { walkEntries } from './filesystem'
import { walkRegistry } from './registry-scan'
import { encodeFile, signatureOf } from './store'
import type { SnapshotStore } from './store'

const SAMPLE_SIZE = 50

export interface AddedItem {
  readonly path: string
  readonly kind: 'file' | 'dir'
  bytes: number
  files: number
}

export interface DiffResult {
  readonly comparedAt: number
  readonly files: AddedItem[]
  readonly keys: string[]
  readonly totals: DiffTotals
  readonly modifiedSample: string[]
}

export interface CaptureCounts {
  readonly files: number
  readonly keys: number
}

/** Writes the current file tree and registry keys into the snapshot's folder. */
export async function captureSnapshot(store: SnapshotStore, id: string, roots: readonly string[], excluded: readonly string[], signal: AbortSignal): Promise<CaptureCounts> {
  let files = 0
  const fileSink = Bun.file(store.file(id, 'files.tsv')).writer()
  try {
    for await (const entry of walkEntries(roots, excluded, signal)) {
      fileSink.write(encodeFile(entry))
      if (entry.kind === 'file') files += 1
    }
  } finally {
    await fileSink.end()
  }

  let keys = 0
  const keySink = Bun.file(store.file(id, 'registry.tsv')).writer()
  try {
    for await (const entry of walkRegistry(signal)) {
      keySink.write(`${entry.hash}\t${entry.key}\n`)
      keys += 1
    }
  } finally {
    await keySink.end()
  }
  return { files, keys }
}

function topAncestor(path: string, directories: ReadonlySet<string>): string | null {
  let top: string | null = null
  let current = dirname(path)
  for (;;) {
    if (directories.has(current.toLowerCase())) top = current
    const parent = dirname(current)
    if (parent === current) return top
    current = parent
  }
}

function hasAddedAncestor(key: string, added: ReadonlySet<string>): boolean {
  for (let cut = key.lastIndexOf('\\'); cut > 0; cut = key.lastIndexOf('\\', cut - 1)) {
    if (added.has(key.slice(0, cut).toLowerCase())) return true
  }
  return false
}

/**
 * Walks the system as it is now and compares it with a snapshot. New folders
 * and keys are reduced to the top-most new ones, so removing a folder covers
 * everything inside it.
 */
export async function compareSnapshot(store: SnapshotStore, id: string, roots: readonly string[], excluded: readonly string[], signal: AbortSignal): Promise<DiffResult> {
  const before = await store.loadFiles(id)
  const seen = new Set<string>()
  const addedDirectories = new Map<string, string>()
  const addedFiles: { readonly path: string; readonly size: number }[] = []
  const modifiedSample: string[] = []
  let modifiedFiles = 0

  for await (const entry of walkEntries(roots, excluded, signal)) {
    const lower = entry.path.toLowerCase()
    const previous = before.get(lower)
    if (previous === undefined) {
      if (entry.kind === 'dir') addedDirectories.set(lower, entry.path)
      else addedFiles.push({ path: entry.path, size: entry.size })
      continue
    }
    seen.add(lower)
    if (previous === signatureOf(entry)) continue
    modifiedFiles += 1
    if (modifiedSample.length < SAMPLE_SIZE) modifiedSample.push(entry.path)
  }

  const directorySet = new Set(addedDirectories.keys())
  const targets = new Map<string, AddedItem>()
  for (const [lower, path] of addedDirectories) {
    if (topAncestor(path, directorySet) === null) targets.set(lower, { path, kind: 'dir', bytes: 0, files: 0 })
  }
  const standalone: AddedItem[] = []
  let addedBytes = 0
  for (const file of addedFiles) {
    addedBytes += file.size
    const top = topAncestor(file.path, directorySet)
    const target = top === null ? undefined : targets.get(top.toLowerCase())
    if (target === undefined) {
      standalone.push({ path: file.path, kind: 'file', bytes: file.size, files: 1 })
    } else {
      target.bytes += file.size
      target.files += 1
    }
  }

  const beforeKeys = await store.loadKeys(id)
  const addedKeys = new Map<string, string>()
  let modifiedKeys = 0
  for await (const entry of walkRegistry(signal)) {
    const hash = beforeKeys.get(entry.key.toLowerCase())
    if (hash === undefined) addedKeys.set(entry.key.toLowerCase(), entry.key)
    else if (hash !== entry.hash) modifiedKeys += 1
  }
  const addedKeySet = new Set(addedKeys.keys())
  const keys = [...addedKeys.values()].filter((key) => !hasAddedAncestor(key, addedKeySet)).sort()

  return {
    comparedAt: Date.now(),
    files: [...targets.values(), ...standalone].sort((a, b) => b.bytes - a.bytes),
    keys,
    totals: { addedFiles: addedFiles.length, addedBytes, addedKeys: addedKeys.size, modifiedFiles, modifiedKeys, removedEntries: before.size - seen.size },
    modifiedSample
  }
}
