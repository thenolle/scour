import type { ScanManager } from '../scanner/manager'
import type { ActionReport, Risk } from '../shared/cleaner-view'
import { formatBytes } from '../shared/format'
import { detectCandidates, findNodeModules } from './detect'
import type { Candidate } from './detect'
import { CleanerError } from './errors'
import type { RuleEnvironment } from './rules'
import type { QuarantineReport, RestoreReport, Vault } from './vault'

export interface Detection {
	readonly id: string
	readonly createdAt: number
	readonly candidates: readonly Candidate[]
}

/**
 * Coordinates detection and the vault. One operation runs at a time, and the
 * browser only ever refers to candidates by the ids of the last detection.
 */
export class CleanerManager {
	private detection: Detection | null = null
	private report: ActionReport | null = null
	private busy = false

	constructor(
		private readonly env: RuleEnvironment,
		readonly vault: Vault,
		private readonly scans: ScanManager
	) { }

	snapshot(): Detection | null {
		return this.detection
	}

	/** Returns the message from the last action once, then clears it. */
	takeReport(): ActionReport | null {
		const report = this.report
		this.report = null
		return report
	}

	fail(message: string): void {
		this.report = { kind: 'error', message, failures: [] }
	}

	detect(scanId: string | null): Promise<Detection> {
		return this.exclusive(async () => {
			const wanted = scanId === null || scanId === '' ? null : scanId
			const result = wanted === null ? null : (this.scans.get(wanted)?.result ?? null)
			if (wanted !== null && result === null) throw new CleanerError('Choose a scan that has finished.')
			const candidates = await detectCandidates(this.env, result === null ? [] : findNodeModules(result))
			const detection: Detection = { id: crypto.randomUUID(), createdAt: Date.now(), candidates }
			this.detection = detection
			return detection
		})
	}

	quarantine(ids: readonly string[]): Promise<QuarantineReport> {
		return this.exclusive(async () => {
			const detection = this.requireDetection()
			const wanted = new Set(ids)
			const chosen = detection.candidates.filter((candidate) => wanted.has(candidate.id))
			if (chosen.length === 0) throw new CleanerError('Select at least one item.')
			return this.apply(detection, chosen)
		})
	}

	quarantineRisk(risk: Risk): Promise<QuarantineReport> {
		return this.exclusive(async () => {
			if (risk === 'review') throw new CleanerError('Items that need review are moved one at a time.')
			const detection = this.requireDetection()
			const chosen = detection.candidates.filter((candidate) => candidate.risk === risk)
			if (chosen.length === 0) throw new CleanerError('There is nothing in that group.')
			return this.apply(detection, chosen)
		})
	}

	restore(id: string): Promise<RestoreReport> {
		return this.exclusive(async () => {
			const result = await this.vault.restore(id)
			this.report = {
				kind: result.restored > 0 ? 'ok' : 'error',
				message: `Restored ${result.restored} ${result.restored === 1 ? 'item' : 'items'} to the original location.`,
				failures: result.failed.map((failure) => `${failure.path}: ${failure.message}`)
			}
			return result
		})
	}

	purge(id: string): Promise<boolean> {
		return this.exclusive(async () => {
			const purged = await this.vault.purge(id)
			this.report = purged ? { kind: 'ok', message: 'Deleted the quarantined items for good.', failures: [] } : { kind: 'error', message: 'That quarantine batch no longer exists.', failures: [] }
			return purged
		})
	}

	purgeExpired(): Promise<number> {
		return this.exclusive(() => this.vault.purgeExpired())
	}

	private requireDetection(): Detection {
		if (this.detection === null) throw new CleanerError('Find junk first.')
		return this.detection
	}

	private async apply(detection: Detection, chosen: readonly Candidate[]): Promise<QuarantineReport> {
		const result = await this.vault.quarantine(chosen)
		const movedPaths = new Set(result.moved.map((item) => item.originalPath))
		this.detection = { ...detection, candidates: detection.candidates.filter((candidate) => !movedPaths.has(candidate.path)) }
		const bytes = result.moved.reduce((sum, item) => sum + item.bytes, 0)
		this.report = {
			kind: result.moved.length > 0 ? 'ok' : 'error',
			message:
				result.moved.length > 0
					? `Moved ${result.moved.length} ${result.moved.length === 1 ? 'item' : 'items'} (${formatBytes(bytes)}) to quarantine. They are deleted for good after ${this.vault.retentionDays} days unless you restore them.`
					: 'Nothing could be moved.',
			failures: result.failed.map((failure) => `${failure.path}: ${failure.message}`)
		}
		return result
	}

	private async exclusive<T>(work: () => Promise<T>): Promise<T> {
		if (this.busy) throw new CleanerError('Another cleaner operation is still running.')
		this.busy = true
		try {
			return await work()
		} finally {
			this.busy = false
		}
	}
}
