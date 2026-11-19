export type ScanStatus = 'running' | 'completed' | 'cancelled' | 'failed'
export type DuplicateStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed'
export type Category = 'video' | 'audio' | 'images' | 'documents' | 'archives' | 'code' | 'applications' | 'system' | 'other'
export type SortKey = 'size' | 'name' | 'items'
export type SortOrder = 'asc' | 'desc'

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
	video: 'Video',
	audio: 'Audio',
	images: 'Images',
	documents: 'Documents',
	archives: 'Archives and disk images',
	code: 'Code and data',
	applications: 'Applications',
	system: 'System files',
	other: 'Other'
}

export type ScanProgress = {
	readonly files: number
	readonly directories: number
	readonly bytes: number
	readonly errors: number
	readonly currentPath: string
}

export const EMPTY_PROGRESS: ScanProgress = { files: 0, directories: 0, bytes: 0, errors: 0, currentPath: '' }

export type DriveInfo = {
	readonly path: string
	readonly totalBytes: number | null
	readonly freeBytes: number | null
}

export type ScanSummary = {
	readonly id: string
	readonly root: string
	readonly status: ScanStatus
	readonly duplicates: DuplicateStatus
	readonly startedAt: number
	readonly finishedAt: number | null
	readonly files: number
	readonly bytes: number
}

export type HomeData = {
	readonly drives: readonly DriveInfo[]
	readonly scans: readonly ScanSummary[]
	readonly error: string | null
}

export type CategoryRow = {
	readonly category: Category
	readonly label: string
	readonly size: number
	readonly count: number
	readonly percent: number
}

export type Crumb = {
	readonly name: string
	readonly href: string
}

export type DirRow = {
	readonly kind: 'dir' | 'file'
	readonly name: string
	readonly path: string
	readonly size: number
	readonly percent: number
	readonly items: number
	readonly category: Category | null
	readonly href: string | null
}

export type HiddenFiles = {
	readonly files: number
	readonly size: number
}

export type TreemapCell = {
	readonly label: string
	readonly kind: 'dir' | 'file'
	readonly category: Category | null
	readonly size: number
	readonly percent: number
	readonly href: string | null
	readonly x: number
	readonly y: number
	readonly width: number
	readonly height: number
}

export type DuplicateGroupView = {
	readonly size: number
	readonly copies: number
	readonly wasted: number
	readonly paths: readonly string[]
}

export type DuplicatesView = {
	readonly status: DuplicateStatus
	readonly done: number
	readonly total: number
	readonly groupCount: number
	readonly reclaimable: number
	readonly groups: readonly DuplicateGroupView[]
	readonly error: string | null
}

export type ScanView = {
	readonly id: string
	readonly root: string
	readonly status: ScanStatus
	readonly error: string | null
	readonly startedAt: number
	readonly finishedAt: number | null
	readonly progress: ScanProgress
	readonly ready: boolean
	readonly totalSize: number
	readonly crumbs: readonly Crumb[]
	readonly directoryPath: string
	readonly directorySize: number
	readonly rows: readonly DirRow[]
	readonly hidden: HiddenFiles
	readonly truncated: number
	readonly treemap: readonly TreemapCell[]
	readonly categories: readonly CategoryRow[]
	readonly query: { readonly sort: SortKey; readonly order: SortOrder }
	readonly duplicates: DuplicatesView
}
