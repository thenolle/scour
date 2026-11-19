import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { mapLimit } from '../cleaner/pool'
import { measurePath } from '../cleaner/measure'
import { assertSafeTarget } from '../cleaner/vault'
import type { Confidence } from '../shared/program-view'
import { hashId, isProtectedName, nameForms, normalizeName, publisherForm } from './names'
import { runPowerShell } from './powershell'
import { isRecord, toProviderPath } from './programs'
import type { Program } from './programs'

export interface LeftoverFile {
  readonly id: string
  readonly path: string
  readonly bytes: number
  readonly files: number
  readonly confidence: Confidence
  readonly reason: string
}

export interface LeftoverKey {
  readonly id: string
  readonly key: string
  readonly confidence: Confidence
  readonly reason: string
}

export interface LeftoverSet {
  readonly scannedAt: number
  files: LeftoverFile[]
  keys: LeftoverKey[]
}

interface Found {
  readonly path: string
  readonly confidence: Confidence
  readonly reason: string
}

const PUBLISHER_REASON = 'Named after the publisher. It may also hold other products.'
const KEY_SCRIPT = [
  '$result = [ordered]@{',
  "  hkcu = @(Get-ChildItem -LiteralPath 'Registry::HKEY_CURRENT_USER\\Software' -Name -ErrorAction SilentlyContinue)",
  "  hklm = @(Get-ChildItem -LiteralPath 'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE' -Name -ErrorAction SilentlyContinue)",
  "  wow = @(Get-ChildItem -LiteralPath 'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node' -Name -ErrorAction SilentlyContinue)",
  '  own = [bool](Test-Path -LiteralPath $env:SCOUR_KEY)',
  '}',
  'ConvertTo-Json -InputObject $result -Compress'
].join('\n')

function fileRoots(): string[] {
  const home = process.env['USERPROFILE'] ?? homedir()
  const localAppData = process.env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local')
  const roots = [process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming'), localAppData, join(localAppData, 'Programs'), process.env['PROGRAMDATA'], process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]
  return roots.filter((root): root is string => root !== undefined && root !== '')
}

function isSafe(path: string): boolean {
  try {
    assertSafeTarget(path)
    return true
  } catch {
    return false
  }
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function classify(name: string, forms: readonly string[], publisher: string | null): { readonly confidence: Confidence; readonly reason: string } | null {
  if (isProtectedName(name)) return null
  const normalized = normalizeName(name)
  if (forms.includes(normalized)) return { confidence: 'high', reason: 'Named after the program' }
  if (publisher !== null && normalized === publisher) return { confidence: 'medium', reason: PUBLISHER_REASON }
  return null
}

async function findFiles(program: Program): Promise<LeftoverFile[]> {
  const forms = nameForms(program.name)
  const publisher = publisherForm(program.publisher)
  const found = new Map<string, Found>()
  const add = (path: string, confidence: Confidence, reason: string): void => {
    if (isSafe(path) && !found.has(path.toLowerCase())) found.set(path.toLowerCase(), { path, confidence, reason })
  }

  const location = program.installLocation.replace(/^"|"$/g, '').replace(/[\\/]+$/, '')
  if (location !== '' && !isProtectedName(basename(location))) add(location, 'high', 'Install location')

  for (const root of fileRoots()) {
    let entries
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const match = classify(entry.name, forms, publisher)
      if (match !== null) add(join(root, entry.name), match.confidence, match.reason)
    }
  }

  const measured = await mapLimit([...found.values()], 4, async (item) => ({ item, size: await measurePath(item.path) }))
  return measured.flatMap(({ item, size }) =>
    size === null ? [] : [{ id: hashId(program.id, item.path), path: item.path, bytes: size.bytes, files: size.files, confidence: item.confidence, reason: item.reason }]
  )
}

async function findKeys(program: Program): Promise<LeftoverKey[]> {
  const result = await runPowerShell(KEY_SCRIPT, { SCOUR_KEY: toProviderPath(program.keyPath) })
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || 'Could not read the registry')
  const data: unknown = JSON.parse(result.stdout.trim())
  if (!isRecord(data)) return []

  const forms = nameForms(program.name)
  const publisher = publisherForm(program.publisher)
  const keys: LeftoverKey[] = []
  const add = (key: string, confidence: Confidence, reason: string): void => {
    keys.push({ id: hashId(program.id, key), key, confidence, reason })
  }
  if (data['own'] === true) add(program.keyPath, 'high', 'The uninstall entry is still registered')
  const parents = [
    { prefix: 'HKCU\\SOFTWARE', names: strings(data['hkcu']) },
    { prefix: 'HKLM\\SOFTWARE', names: strings(data['hklm']) },
    { prefix: 'HKLM\\SOFTWARE\\WOW6432Node', names: strings(data['wow']) }
  ]
  for (const parent of parents) {
    for (const name of parent.names) {
      const match = classify(name, forms, publisher)
      if (match !== null) add(`${parent.prefix}\\${name}`, match.confidence, match.reason)
    }
  }
  return keys
}

/** Looks for folders and registry keys a program left behind. Reads only; nothing is changed. */
export async function findLeftovers(program: Program): Promise<LeftoverSet> {
  const [files, keys] = await Promise.all([findFiles(program), findKeys(program)])
  return { scannedAt: Date.now(), files, keys }
}
