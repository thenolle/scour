import { access, readdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { ScanResult } from '../scanner/scanner'
import type { DirNode } from '../scanner/tree'
import type { Risk } from '../shared/cleaner-view'
import { measurePath } from './measure'
import { mapLimit } from './pool'
import { RULES, expandPattern } from './rules'
import type { CleanRule, RuleEnvironment } from './rules'

const MEASURE_CONCURRENCY = 4
const LOCKFILES = ['bun.lock', 'bun.lockb', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'] as const

export interface Candidate {
  readonly id: string
  readonly ruleId: string
  readonly group: string
  readonly title: string
  readonly path: string
  readonly risk: Risk
  readonly bytes: number
  readonly files: number
  readonly note: string
}

export interface NodeModulesHit {
  readonly path: string
  readonly bytes: number
  readonly files: number
}

function idFor(path: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(path.toLowerCase())
  return hasher.digest('hex').slice(0, 16)
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function targetsFor(rule: CleanRule, env: RuleEnvironment): Promise<string[]> {
  const roots = (await Promise.all(rule.patterns(env).map((pattern) => expandPattern(pattern)))).flat()
  if (rule.granularity === 'whole') return roots
  const children: string[] = []
  for (const root of roots) {
    try {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isSymbolicLink()) children.push(join(root, entry.name))
      }
    } catch {
      continue
    }
  }
  return children
}

function insideNodeModules(node: DirNode | null): boolean {
  for (let current = node; current !== null; current = current.parent) {
    if (current.name === 'node_modules') return true
  }
  return false
}

/** Finds top-level `node_modules` folders in a finished scan. Nested ones are skipped. */
export function findNodeModules(result: ScanResult): NodeModulesHit[] {
  const hits: NodeModulesHit[] = []
  for (const node of result.index.values()) {
    if (node.name !== 'node_modules' || node.parent === null || insideNodeModules(node.parent)) continue
    hits.push({ path: node.path, bytes: node.size, files: node.fileCount })
  }
  return hits
}

async function nodeModulesRisk(project: string): Promise<Risk> {
  if (!(await exists(join(project, 'package.json')))) return 'review'
  for (const lockfile of LOCKFILES) {
    if (await exists(join(project, lockfile))) return 'redownloadable'
  }
  return 'review'
}

/**
 * Looks for removable data in every known location, plus the given
 * `node_modules` folders, and returns it largest first. Empty and missing
 * locations are left out.
 */
export async function detectCandidates(env: RuleEnvironment, nodeModules: readonly NodeModulesHit[]): Promise<Candidate[]> {
  const targets: { readonly rule: CleanRule; readonly path: string }[] = []
  for (const rule of RULES) {
    for (const path of await targetsFor(rule, env)) targets.push({ rule, path })
  }
  const measured = await mapLimit(targets, MEASURE_CONCURRENCY, async ({ rule, path }) => ({ rule, path, size: await measurePath(path) }))

  const found = new Map<string, Candidate>()
  for (const { rule, path, size } of measured) {
    if (size === null || size.bytes <= 0) continue
    const key = path.toLowerCase()
    if (found.has(key)) continue
    found.set(key, {
      id: idFor(path),
      ruleId: rule.id,
      group: rule.group,
      title: rule.granularity === 'whole' ? rule.title : `${rule.title}: ${basename(path)}`,
      path,
      risk: rule.risk,
      bytes: size.bytes,
      files: size.files,
      note: rule.note
    })
  }

  for (const hit of nodeModules) {
    const key = hit.path.toLowerCase()
    if (hit.bytes <= 0 || found.has(key)) continue
    const project = dirname(hit.path)
    const risk = await nodeModulesRisk(project)
    found.set(key, {
      id: idFor(hit.path),
      ruleId: 'node-modules',
      group: 'Developer',
      title: `node_modules in ${basename(project)}`,
      path: hit.path,
      risk,
      bytes: hit.bytes,
      files: hit.files,
      note: risk === 'redownloadable' ? 'Reinstalled with your package manager from the lockfile next to it.' : 'There is no package.json and lockfile next to it, so it may not be reproducible.'
    })
  }
  return [...found.values()].sort((a, b) => b.bytes - a.bytes)
}
