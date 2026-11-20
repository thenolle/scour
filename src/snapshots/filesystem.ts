import { lstat, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { ScanCancelled } from '../scanner/cancel'

const STAT_BATCH = 64

export interface FsEntry {
  readonly path: string
  readonly kind: 'file' | 'dir'
  readonly size: number
  readonly modified: number
}

type Environment = Record<string, string | undefined>

function present(values: readonly (string | undefined)[]): string[] {
  return values.filter((value): value is string => value !== undefined && value !== '')
}

/** The folders installers write to. System folders under C:\Windows are not covered. */
export function snapshotRoots(env: Environment = process.env): string[] {
  const home = env['USERPROFILE'] ?? homedir()
  const publicDesktop = env['PUBLIC'] === undefined ? undefined : join(env['PUBLIC'], 'Desktop')
  return present([
    env['ProgramFiles'],
    env['ProgramFiles(x86)'],
    env['ProgramData'],
    env['APPDATA'] ?? join(home, 'AppData', 'Roaming'),
    env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local'),
    join(home, 'Desktop'),
    publicDesktop
  ])
}

/** Lower-cased folders that change constantly and are never part of an install. */
export function snapshotExclusions(dataDirectory: string, env: Environment = process.env): string[] {
  const local = env['LOCALAPPDATA'] ?? ''
  const programData = env['ProgramData'] ?? ''
  const programFiles = env['ProgramFiles'] ?? ''
  return [
    dataDirectory,
    join(local, 'Temp'),
    join(local, 'Packages'),
    join(local, 'CrashDumps'),
    join(local, 'D3DSCache'),
    join(local, 'Microsoft', 'Windows', 'INetCache'),
    join(local, 'Microsoft', 'Windows', 'WebCache'),
    join(local, 'Google', 'Chrome', 'User Data'),
    join(local, 'Microsoft', 'Edge', 'User Data'),
    join(programData, 'Microsoft', 'Windows Defender'),
    join(programData, 'Microsoft', 'Windows', 'WER'),
    join(programFiles, 'WindowsApps')
  ]
    .filter((path) => isAbsolute(path))
    .map((path) => path.toLowerCase().replace(/[\\/]+$/, ''))
}

export function isExcluded(path: string, excluded: readonly string[]): boolean {
  const lower = path.toLowerCase()
  return excluded.some((prefix) => lower === prefix || lower.startsWith(`${prefix}\\`))
}

/** Walks the roots depth first without following links. Unreadable folders are skipped. */
export async function* walkEntries(roots: readonly string[], excluded: readonly string[], signal: AbortSignal): AsyncGenerator<FsEntry> {
  const pending = [...roots]
  for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
    if (signal.aborted) throw new ScanCancelled()
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }
    const files: string[] = []
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (isExcluded(path, excluded)) continue
        pending.push(path)
        yield { path, kind: 'dir', size: 0, modified: 0 }
      } else if (entry.isFile()) {
        files.push(path)
      }
    }
    for (let start = 0; start < files.length; start += STAT_BATCH) {
      const stats = await Promise.all(
        files.slice(start, start + STAT_BATCH).map(async (path) => {
          try {
            const stat = await lstat(path)
            return { path, size: stat.size, modified: Math.round(stat.mtimeMs) }
          } catch {
            return null
          }
        })
      )
      for (const stat of stats) {
        if (stat !== null) yield { path: stat.path, kind: 'file', size: stat.size, modified: stat.modified }
      }
    }
  }
}
