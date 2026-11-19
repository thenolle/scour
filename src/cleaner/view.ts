import type { ScanManager } from '../scanner/manager'
import { RISK_LABELS, RISK_ORDER, RISK_SUMMARIES } from '../shared/cleaner-view'
import type { ActionReport, BatchView, CandidateView, CleanerView, RiskGroupView } from '../shared/cleaner-view'
import type { Candidate } from './detect'
import type { CleanerManager } from './manager'
import type { VaultBatch } from './vault'

function toCandidateView(candidate: Candidate): CandidateView {
	return { id: candidate.id, title: candidate.title, path: candidate.path, bytes: candidate.bytes, files: candidate.files, note: candidate.note }
}

export function toBatchView(batch: VaultBatch): BatchView {
	const { manifest } = batch
	return {
		id: manifest.id,
		createdAt: manifest.createdAt,
		expiresAt: manifest.expiresAt,
		bytes: manifest.items.reduce((sum, item) => sum + item.bytes, 0),
		items: manifest.items.map((item) => ({ name: item.storedName, originalPath: item.originalPath, bytes: item.bytes, kind: item.kind }))
	}
}

/** Turns the cleaner state into the plain data the cleaner page renders. */
export function buildCleanerView(cleaner: CleanerManager, scans: ScanManager, report: ActionReport | null): CleanerView {
	const detection = cleaner.snapshot()
	const candidates = detection === null ? [] : detection.candidates
	const groups = RISK_ORDER.map((risk): RiskGroupView => {
		const items = candidates.filter((candidate) => candidate.risk === risk).map(toCandidateView)
		return { risk, label: RISK_LABELS[risk], summary: RISK_SUMMARIES[risk], bytes: items.reduce((sum, item) => sum + item.bytes, 0), candidates: items }
	})
	return {
		detectedAt: detection === null ? null : detection.createdAt,
		totalBytes: groups.reduce((sum, group) => sum + group.bytes, 0),
		groups,
		scanOptions: scans
			.list()
			.filter((session) => session.result !== null)
			.map((session) => ({ id: session.id, root: session.root })),
		batches: cleaner.vault.list().map(toBatchView),
		retentionDays: cleaner.vault.retentionDays,
		report
	}
}
