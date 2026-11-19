import { basename } from 'node:path'
import type { Candidate } from '../cleaner/detect'
import { CleanerError, describe } from '../cleaner/errors'
import type { Vault } from '../cleaner/vault'
import type { ActionReport } from '../shared/cleaner-view'
import type { ScanEvent } from '../shared/events'
import type { JobStatus, UninstallMode } from '../shared/program-view'
import { planUninstall, runPlan } from './command'
import { findLeftovers } from './leftovers'
import type { LeftoverFile, LeftoverSet } from './leftovers'
import { listPrograms } from './programs'
import type { Program } from './programs'
import type { RegistrySurgeon } from './registry'

export interface UninstallJob {
	status: JobStatus
	readonly mode: UninstallMode
	readonly startedAt: number
	finishedAt: number | null
	message: string | null
}

function toCandidate(file: LeftoverFile, program: Program): Candidate {
	return { id: file.id, ruleId: 'leftover', group: 'Leftovers', title: `${program.name}: ${basename(file.path)}`, path: file.path, risk: 'review', bytes: file.bytes, files: file.files, note: file.reason }
}

/** Lists programs, runs their uninstallers in the background, and removes what they leave behind. */
export class UninstallManager {
	private current: readonly Program[] = []
	private readonly known = new Map<string, Program>()
	private readonly jobs = new Map<string, UninstallJob>()
	private readonly leftovers = new Map<string, LeftoverSet>()
	private loadedAt: number | null = null
	private report: ActionReport | null = null
	private busy = false

	constructor(
		readonly surgeon: RegistrySurgeon,
		private readonly vault: Vault,
		private readonly publish: (event: ScanEvent) => void
	) { }

	programs(): readonly Program[] {
		return this.current
	}

	loaded(): number | null {
		return this.loadedAt
	}

	get(id: string): Program | undefined {
		return this.known.get(id)
	}

	isInstalled(id: string): boolean {
		return this.current.some((program) => program.id === id)
	}

	job(id: string): UninstallJob | undefined {
		return this.jobs.get(id)
	}

	leftoversFor(id: string): LeftoverSet | undefined {
		return this.leftovers.get(id)
	}

	takeReport(): ActionReport | null {
		const report = this.report
		this.report = null
		return report
	}

	fail(message: string): void {
		this.report = { kind: 'error', message, failures: [] }
	}

	async refresh(): Promise<void> {
		try {
			const programs = await listPrograms()
			this.current = programs
			for (const program of programs) this.known.set(program.id, program)
			this.loadedAt = Date.now()
		} catch (error) {
			throw new CleanerError(`Could not read the installed programs: ${describe(error)}`)
		}
	}

	startUninstall(id: string, mode: UninstallMode): void {
		const program = this.require(id)
		if (this.jobs.get(id)?.status === 'running') throw new CleanerError('This program is already being uninstalled.')
		const target = planUninstall(program, mode)
		if (target === null) throw new CleanerError('This program has no silent uninstaller. Use the interactive one.')
		const job: UninstallJob = { status: 'running', mode, startedAt: Date.now(), finishedAt: null, message: null }
		this.jobs.set(id, job)
		this.publish({ type: 'job', id, status: 'running' })
		void this.runJob(program, target, job)
	}

	scanLeftovers(id: string): Promise<void> {
		return this.exclusive(async () => {
			this.leftovers.set(id, await findLeftovers(this.require(id)))
		})
	}

	removeLeftovers(id: string, selected: readonly string[]): Promise<void> {
		return this.exclusive(async () => {
			const program = this.require(id)
			const set = this.leftovers.get(id)
			if (set === undefined) throw new CleanerError('Scan for leftovers first.')
			if (this.jobs.get(id)?.status === 'running') throw new CleanerError('Wait for the uninstaller to finish.')
			const wanted = new Set(selected)
			const files = set.files.filter((file) => wanted.has(file.id))
			const keys = set.keys.filter((key) => wanted.has(key.id))
			if (files.length + keys.length === 0) throw new CleanerError('Select at least one item.')

			const failures: string[] = []
			let movedFiles = 0
			let deletedKeys = 0
			if (files.length > 0) {
				const result = await this.vault.quarantine(files.map((file) => toCandidate(file, program)))
				movedFiles = result.moved.length
				failures.push(...result.failed.map((failure) => `${failure.path}: ${failure.message}`))
				const moved = new Set(result.moved.map((item) => item.originalPath))
				set.files = set.files.filter((file) => !moved.has(file.path))
			}
			if (keys.length > 0) {
				const result = await this.surgeon.removeKeys(program.name, keys.map((key) => key.key))
				deletedKeys = result.deleted.length
				failures.push(...result.failed.map((failure) => `${failure.key}: ${failure.message}`))
				const gone = new Set(result.deleted)
				set.keys = set.keys.filter((key) => !gone.has(key.key))
			}
			this.report = {
				kind: movedFiles + deletedKeys > 0 ? 'ok' : 'error',
				message: `Moved ${movedFiles} ${movedFiles === 1 ? 'folder' : 'folders'} to quarantine and removed ${deletedKeys} registry ${deletedKeys === 1 ? 'key' : 'keys'}. Registry keys were exported first and can be restored from the backups on the programs page.`,
				failures
			}
		})
	}

	restoreBackup(id: string): Promise<void> {
		return this.exclusive(async () => {
			const result = await this.surgeon.restore(id)
			this.report = { kind: result.restored > 0 ? 'ok' : 'error', message: `Imported ${result.restored} registry ${result.restored === 1 ? 'key' : 'keys'} from the backup.`, failures: result.failed }
		})
	}

	discardBackup(id: string): Promise<void> {
		return this.exclusive(async () => {
			const discarded = await this.surgeon.discard(id)
			this.report = discarded ? { kind: 'ok', message: 'Deleted the registry backup.', failures: [] } : { kind: 'error', message: 'That registry backup no longer exists.', failures: [] }
		})
	}

	private require(id: string): Program {
		const program = this.known.get(id)
		if (program === undefined) throw new CleanerError('Unknown program. Refresh the list and try again.')
		return program
	}

	private async runJob(program: Program, target: Parameters<typeof runPlan>[0], job: UninstallJob): Promise<void> {
		const outcome = await runPlan(target)
		const restart = outcome.exitCode === 3010 || outcome.exitCode === 1641
		job.status = outcome.exitCode === 0 || restart ? 'completed' : 'failed'
		job.message = restart ? 'The uninstaller finished and asks for a restart.' : outcome.exitCode === 0 ? 'The uninstaller finished.' : (outcome.error ?? `The uninstaller exited with code ${outcome.exitCode}.`)
		job.finishedAt = Date.now()
		try {
			await this.refresh()
		} catch (error) {
			console.error('[scour] could not refresh programs after uninstalling', error)
		}
		this.publish({ type: 'job', id: program.id, status: job.status })
	}

	private async exclusive<T>(work: () => Promise<T>): Promise<T> {
		if (this.busy) throw new CleanerError('Another operation is still running.')
		this.busy = true
		try {
			return await work()
		} finally {
			this.busy = false
		}
	}
}
