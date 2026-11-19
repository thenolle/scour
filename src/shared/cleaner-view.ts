export type Risk = 'safe' | 'redownloadable' | 'review'

export const RISK_ORDER: readonly Risk[] = ['safe', 'redownloadable', 'review']

export const RISK_LABELS: Readonly<Record<Risk, string>> = {
	safe: 'Safe',
	redownloadable: 'Re-downloadable',
	review: 'Needs review'
}

export const RISK_SUMMARIES: Readonly<Record<Risk, string>> = {
	safe: 'Programs recreate these files on their own. Nothing of value is lost.',
	redownloadable: 'Caches and packages that are downloaded again when a program needs them. The next run may be slower.',
	review: 'Large or personal data. Check each item before moving it.'
}

export type CandidateView = {
	readonly id: string
	readonly title: string
	readonly path: string
	readonly bytes: number
	readonly files: number
	readonly note: string
}

export type RiskGroupView = {
	readonly risk: Risk
	readonly label: string
	readonly summary: string
	readonly bytes: number
	readonly candidates: readonly CandidateView[]
}

export type BatchItemView = {
	readonly name: string
	readonly originalPath: string
	readonly bytes: number
	readonly kind: 'file' | 'dir'
}

export type BatchView = {
	readonly id: string
	readonly createdAt: number
	readonly expiresAt: number
	readonly bytes: number
	readonly items: readonly BatchItemView[]
}

export type ActionReport = {
	readonly kind: 'ok' | 'error'
	readonly message: string
	readonly failures: readonly string[]
}

export type ScanOption = {
	readonly id: string
	readonly root: string
}

export type CleanerView = {
	readonly detectedAt: number | null
	readonly totalBytes: number
	readonly groups: readonly RiskGroupView[]
	readonly scanOptions: readonly ScanOption[]
	readonly batches: readonly BatchView[]
	readonly retentionDays: number
	readonly report: ActionReport | null
}
