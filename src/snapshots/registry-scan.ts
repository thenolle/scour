import { ScanCancelled } from '../scanner/cancel'

export interface RegistryEntry {
  readonly key: string
  readonly hash: string
}

export const REGISTRY_ROOTS = ['HKCU\\Software', 'HKLM\\SOFTWARE'] as const

const HIVES: readonly (readonly [string, string])[] = [
  ['HKEY_CURRENT_USER\\', 'HKCU\\'],
  ['HKEY_LOCAL_MACHINE\\', 'HKLM\\']
]

function shortKey(line: string): string | null {
  const text = line.trimEnd()
  for (const [long, short] of HIVES) {
    if (text.startsWith(long)) return `${short}${text.slice(long.length)}`
  }
  return null
}

function entryOf(key: string | null, values: string): RegistryEntry | null {
  return key === null || key.includes('\uFFFD') ? null : { key, hash: Bun.hash(values).toString(36) }
}

async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  let rest = ''
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    rest += decoder.decode(chunk.value, { stream: true })
    const parts = rest.split('\n')
    rest = parts.pop() ?? ''
    yield* parts
  }
  rest += decoder.decode()
  if (rest !== '') yield rest
}

/**
 * Streams every key under the registry roots with a hash of its values, using
 * `reg query /s`. Keys whose names are not plain text are skipped.
 */
export async function* walkRegistry(signal: AbortSignal): AsyncGenerator<RegistryEntry> {
  for (const root of REGISTRY_ROOTS) {
    const child = Bun.spawn(['reg.exe', 'query', root, '/s'], { stdout: 'pipe', stderr: 'ignore' })
    let key: string | null = null
    let values = ''
    try {
      for await (const line of readLines(child.stdout)) {
        if (signal.aborted) throw new ScanCancelled()
        const next = shortKey(line)
        if (next === null) {
          values += line
          continue
        }
        const finished = entryOf(key, values)
        if (finished !== null) yield finished
        key = next
        values = ''
      }
      const last = entryOf(key, values)
      if (last !== null) yield last
    } finally {
      if (child.exitCode === null) child.kill()
    }
    await child.exited
  }
}
