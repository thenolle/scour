import type { ActionReport } from './cleaner-view'

export type JobStatus = 'running' | 'completed' | 'failed'
export type UninstallMode = 'silent' | 'interactive'
export type Confidence = 'high' | 'medium'
export type ProgramSort = 'name' | 'size' | 'date'

export type ProgramView = {
	readonly id: string
	readonly name: string
	readonly version: string
	readonly publisher: string
	readonly installDate: string
	readonly sizeBytes: number | null
	readonly source: string
	readonly installLocation: string
}

export type BackupView = {
	readonly id: string
	readonly createdAt: number
	readonly programName: string
	readonly keys: readonly string[]
}

export type ProgramListView = {
	readonly programs: readonly ProgramView[]
	readonly total: number
	readonly query: string
	readonly sort: ProgramSort
	readonly loadedAt: number | null
	readonly backups: readonly BackupView[]
	readonly report: ActionReport | null
}

export type JobView = {
	readonly status: JobStatus
	readonly mode: UninstallMode
	readonly startedAt: number
	readonly finishedAt: number | null
	readonly message: string | null
}

export type LeftoverFileView = {
	readonly id: string
	readonly path: string
	readonly bytes: number
	readonly files: number
	readonly confidence: Confidence
	readonly reason: string
}

export type LeftoverKeyView = {
	readonly id: string
	readonly key: string
	readonly confidence: Confidence
	readonly reason: string
}

export type LeftoversView = {
	readonly scannedAt: number
	readonly files: readonly LeftoverFileView[]
	readonly keys: readonly LeftoverKeyView[]
}

export type ProgramDetailView = {
	readonly program: ProgramView
	readonly keyPath: string
	readonly stillInstalled: boolean
	readonly silentCommand: string | null
	readonly interactiveCommand: string | null
	readonly job: JobView | null
	readonly leftovers: LeftoversView | null
	readonly report: ActionReport | null
}
