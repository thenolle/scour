import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { SnapshotStatus } from '../shared/snapshot-view'
import { isRecord } from '../uninstaller/programs'
import type { FsEntry } from './filesystem'

export interface SnapshotMeta {
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly createdAt: number
  status: SnapshotStatus
  files: number
  keys: number
  error: string | null
}

function kindCode(entry: FsEntry): string {
  return entry.kind === 'dir' ? 'd' : 'f'
}

export function encodeFile(entry: FsEntry): string {
  return `${kindCode(entry)}\t${entry.size}\t${entry.modified}\t${entry.path}\n`
}

export function signatureOf(entry: FsEntry): string {
  return `${kindCode(entry)}|${entry.size}|${entry.modified}`
}

function isStatus(value: unknown): value is SnapshotStatus {
  return value === 'running' || value === 'ready' || value === 'failed'
}

function parseMeta(value: unknown): SnapshotMeta | null {
  if (!isRecord(value) || value['version'] !== 1) return null
  const id = value['id']
  const name = value['name']
  const createdAt = value['createdAt']
  const status = value['status']
  const files = value['files']
  const keys = value['keys']
  const error = value['error']
  if (typeof id !== 'string' || typeof name !== 'string' || typeof createdAt !== 'number') return null
  if (!isStatus(status) || typeof files !== 'number' || typeof keys !== 'number') return null
  if (error !== null && typeof error !== 'string') return null
  return { version: 1, id, name, createdAt, status, files, keys, error }
}

/** Keeps each snapshot in its own folder: `meta.json`, `files.tsv` and `registry.tsv`. */
export class SnapshotStore {
  constructor(readonly directory: string) {}

  file(id: string, name: string): string {
    return join(this.directory, id, name)
  }

  async create(meta: SnapshotMeta): Promise<void> {
    await mkdir(join(this.directory, meta.id), { recursive: true })
    await this.writeMeta(meta)
  }

  async writeMeta(meta: SnapshotMeta): Promise<void> {
    const target = this.file(meta.id, 'meta.json')
    await Bun.write(`${target}.tmp`, JSON.stringify(meta, null, 2))
    await rename(`${target}.tmp`, target)
  }

  /** Reads every snapshot. One that was still running when the server stopped is marked failed. */
  async list(): Promise<SnapshotMeta[]> {
    let names: string[]
    try {
      names = await readdir(this.directory)
    } catch {
      return []
    }
    const found: SnapshotMeta[] = []
    for (const name of names) {
      try {
        const meta = parseMeta(await Bun.file(this.file(name, 'meta.json')).json())
        if (meta === null || meta.id !== name) continue
        if (meta.status === 'running') {
          meta.status = 'failed'
          meta.error = 'Interrupted by a restart'
          await this.writeMeta(meta)
        }
        found.push(meta)
      } catch {
        continue
      }
    }
    return found.sort((a, b) => b.createdAt - a.createdAt)
  }

  /** Maps each lower-cased path to the `kind|size|modified` signature it had. */
  async loadFiles(id: string): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    for (const line of (await Bun.file(this.file(id, 'files.tsv')).text()).split('\n')) {
      const parts = line.split('\t')
      const path = parts[3]
      if (path !== undefined && path !== '') map.set(path.toLowerCase(), `${parts[0]}|${parts[1]}|${parts[2]}`)
    }
    return map
  }

  /** Maps each lower-cased registry key to the hash of its values. */
  async loadKeys(id: string): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    for (const line of (await Bun.file(this.file(id, 'registry.tsv')).text()).split('\n')) {
      const tab = line.indexOf('\t')
      if (tab > 0) map.set(line.slice(tab + 1).toLowerCase(), line.slice(0, tab))
    }
    return map
  }

  async remove(id: string): Promise<void> {
    await rm(join(this.directory, id), { recursive: true, force: true })
  }
}
