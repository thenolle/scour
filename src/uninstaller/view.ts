import type { ActionReport } from '../shared/cleaner-view'
import type { ProgramDetailView, ProgramListView, ProgramSort, ProgramView } from '../shared/program-view'
import { planUninstall } from './command'
import type { UninstallManager } from './manager'
import type { Program } from './programs'

function toView(program: Program): ProgramView {
  return { id: program.id, name: program.name, version: program.version, publisher: program.publisher, installDate: program.installDate, sizeBytes: program.sizeBytes, source: program.source, installLocation: program.installLocation }
}

export function parseSort(value: string | null): ProgramSort {
  return value === 'size' || value === 'date' ? value : 'name'
}

export function buildProgramListView(manager: UninstallManager, params: URLSearchParams, report: ActionReport | null): ProgramListView {
  const query = (params.get('q') ?? '').trim()
  const sort = parseSort(params.get('sort'))
  const needle = query.toLowerCase()
  const all = manager.programs()
  const matching = all.filter((program) => needle === '' || program.name.toLowerCase().includes(needle) || program.publisher.toLowerCase().includes(needle))
  const sorted = [...matching].sort((a, b) => {
    if (sort === 'size') return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0) || a.name.localeCompare(b.name)
    if (sort === 'date') return b.installDate.localeCompare(a.installDate) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name)
  })
  return {
    programs: sorted.map(toView),
    total: all.length,
    query,
    sort,
    loadedAt: manager.loaded(),
    backups: manager.surgeon.list().map((backup) => ({ id: backup.id, createdAt: backup.createdAt, programName: backup.programName, keys: backup.entries.filter((entry) => entry.deleted).map((entry) => entry.key) })),
    report
  }
}

export function buildProgramDetailView(manager: UninstallManager, id: string, report: ActionReport | null): ProgramDetailView | null {
  const program = manager.get(id)
  if (program === undefined) return null
  const job = manager.job(id)
  const leftovers = manager.leftoversFor(id)
  return {
    program: toView(program),
    keyPath: program.keyPath,
    stillInstalled: manager.isInstalled(id),
    silentCommand: planUninstall(program, 'silent')?.display ?? null,
    interactiveCommand: planUninstall(program, 'interactive')?.display ?? null,
    job: job === undefined ? null : { status: job.status, mode: job.mode, startedAt: job.startedAt, finishedAt: job.finishedAt, message: job.message },
    leftovers: leftovers === undefined ? null : { scannedAt: leftovers.scannedAt, files: leftovers.files, keys: leftovers.keys },
    report
  }
}
