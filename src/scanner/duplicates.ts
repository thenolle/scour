import { ScanCancelled } from './cancel'

const ALGORITHM = 'blake2b256' as const
const PARTIAL_BYTES = 64 * 1024
const CONCURRENCY = 4

export interface DuplicateGroup {
  readonly size: number
  readonly hash: string
  readonly paths: readonly string[]
}

export interface DuplicateOptions {
  readonly signal: AbortSignal
  readonly onProgress: (done: number, total: number) => void
}

async function hashFile(path: string, limit: number | null, signal: AbortSignal): Promise<string | null> {
  try {
    const hasher = new Bun.CryptoHasher(ALGORITHM)
    const file = Bun.file(path)
    if (limit !== null) {
      hasher.update(await file.slice(0, limit).arrayBuffer())
      return hasher.digest('hex')
    }
    const reader = file.stream().getReader()
    try {
      for (;;) {
        if (signal.aborted) throw new ScanCancelled()
        const chunk = await reader.read()
        if (chunk.done) break
        hasher.update(chunk.value)
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }
    return hasher.digest('hex')
  } catch (error) {
    if (error instanceof ScanCancelled) throw error
    return null
  }
}

async function hashAll(paths: readonly string[], limit: number | null, signal: AbortSignal, tick: () => void): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array<string | null>(paths.length).fill(null)
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next
      next += 1
      const path = paths[index]
      if (path === undefined) return
      if (signal.aborted) throw new ScanCancelled()
      results[index] = await hashFile(path, limit, signal)
      tick()
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, paths.length) }, () => worker()))
  return results
}

function groupByHash(paths: readonly string[], hashes: readonly (string | null)[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  paths.forEach((path, index) => {
    const hash = hashes[index]
    if (hash === null || hash === undefined) return
    const group = groups.get(hash)
    if (group === undefined) groups.set(hash, [path])
    else group.push(path)
  })
  return groups
}

/**
 * Finds files with identical content. Files are grouped by size, then by a
 * BLAKE2b-256 hash of their first 64 KiB, and only the survivors are hashed
 * in full. Hard links to the same data are reported as duplicates.
 */
export async function findDuplicates(candidates: ReadonlyMap<number, readonly string[]>, options: DuplicateOptions): Promise<DuplicateGroup[]> {
  const sizeGroups = [...candidates].filter(([, paths]) => paths.length > 1)
  let total = 0
  for (const [, paths] of sizeGroups) total += paths.length * 2
  let done = 0
  const tick = (): void => {
    done += 1
    options.onProgress(done, total)
  }
  options.onProgress(0, total)

  const found: DuplicateGroup[] = []
  for (const [size, paths] of sizeGroups) {
    const partial = groupByHash(paths, await hashAll(paths, PARTIAL_BYTES, options.signal, tick))
    for (const sameStart of partial.values()) {
      if (sameStart.length < 2) {
        done += sameStart.length
        continue
      }
      const full = groupByHash(sameStart, await hashAll(sameStart, null, options.signal, tick))
      for (const [hash, same] of full) {
        if (same.length > 1) found.push({ size, hash, paths: [...same].sort() })
      }
    }
    done = Math.min(total, done)
    options.onProgress(done, total)
  }
  return found.sort((a, b) => b.size * (b.paths.length - 1) - a.size * (a.paths.length - 1))
}
