import { CATEGORY_LABELS } from '../shared/scan-view'
import type { CategoryRow, Crumb, DirRow, DuplicatesView, ScanSummary, ScanView, SortKey, SortOrder, TreemapCell } from '../shared/scan-view'
import { scanHref } from '../shared/links'
import { categorize } from './categories'
import type { ScanSession } from './manager'
import type { DirNode } from './tree'
import { squarify } from './treemap'

const MAX_ROWS = 500
const MAX_CELLS = 48
const MAX_GROUPS = 100
const TREEMAP_HEIGHT_UNITS = 44

export interface ViewQuery {
	readonly dir: string | null
	readonly sort: SortKey
	readonly order: SortOrder
}

export function parseQuery(params: URLSearchParams): ViewQuery {
	const sortParam = params.get('sort')
	const sort: SortKey = sortParam === 'name' || sortParam === 'items' ? sortParam : 'size'
	const orderParam = params.get('order')
	const order: SortOrder = orderParam === 'asc' || orderParam === 'desc' ? orderParam : sort === 'name' ? 'asc' : 'desc'
	return { dir: params.get('dir'), sort, order }
}

export function summarize(session: ScanSession): ScanSummary {
	return {
		id: session.id,
		root: session.root,
		status: session.status,
		duplicates: session.duplicates.status,
		startedAt: session.startedAt,
		finishedAt: session.finishedAt,
		files: session.progress.files,
		bytes: session.progress.bytes
	}
}

function comparator(sort: SortKey, order: SortOrder): (a: DirRow, b: DirRow) => number {
	const sign = order === 'asc' ? 1 : -1
	return (a, b) => {
		const difference = sort === 'name' ? a.name.localeCompare(b.name) : sort === 'items' ? a.items - b.items : a.size - b.size
		return difference !== 0 ? sign * difference : a.name.localeCompare(b.name)
	}
}

function duplicatesView(session: ScanSession): DuplicatesView {
	const state = session.duplicates
	let reclaimable = 0
	for (const group of state.groups) reclaimable += group.size * (group.paths.length - 1)
	return {
		status: state.status,
		done: state.done,
		total: state.total,
		groupCount: state.groups.length,
		reclaimable,
		groups: state.groups.slice(0, MAX_GROUPS).map((group) => ({
			size: group.size,
			copies: group.paths.length,
			wasted: group.size * (group.paths.length - 1),
			paths: group.paths
		})),
		error: state.error
	}
}

/** Turns a scan session into the plain data a scan page renders. */
export function buildScanView(session: ScanSession, query: ViewQuery): ScanView {
	const { id } = session
	const base = {
		id,
		root: session.root,
		status: session.status,
		error: session.error,
		startedAt: session.startedAt,
		finishedAt: session.finishedAt,
		progress: session.progress,
		query: { sort: query.sort, order: query.order },
		duplicates: duplicatesView(session)
	}
	const result = session.result
	if (result === null) {
		return {
			...base,
			ready: false,
			totalSize: 0,
			crumbs: [],
			directoryPath: session.root,
			directorySize: 0,
			rows: [],
			hidden: { files: 0, size: 0 },
			truncated: 0,
			treemap: [],
			categories: []
		}
	}

	const node: DirNode = (query.dir === null ? undefined : result.index.get(query.dir)) ?? result.root
	const link = (target: DirNode): string => scanHref(id, { dir: target.path, sort: query.sort, order: query.order })
	const total = Math.max(node.size, 1)

	const crumbs: Crumb[] = []
	for (let current: DirNode | null = node; current !== null; current = current.parent) {
		crumbs.unshift({ name: current.name, href: link(current) })
	}

	const dirRow = (child: DirNode): DirRow => ({
		kind: 'dir',
		name: child.name,
		path: child.path,
		size: child.size,
		percent: (child.size / total) * 100,
		items: child.fileCount,
		category: null,
		href: link(child)
	})
	const fileRows = node.files.map(
		(file): DirRow => ({
			kind: 'file',
			name: file.name,
			path: `${node.path}\\${file.name}`,
			size: file.size,
			percent: (file.size / total) * 100,
			items: 1,
			category: categorize(file.name),
			href: null
		})
	)
	const all = [...node.children.map(dirRow), ...fileRows]
	const sorted = [...all].sort(comparator(query.sort, query.order))

	let shownFileSize = 0
	for (const file of node.files) shownFileSize += file.size

	const cellRows = [...all].sort(comparator('size', 'desc')).slice(0, MAX_CELLS)
	const treemap: TreemapCell[] = squarify(
		cellRows.map((row) => ({ row, value: row.size })),
		100,
		TREEMAP_HEIGHT_UNITS
	).map(({ item, x, y, width, height }) => ({
		label: item.row.name,
		kind: item.row.kind,
		category: item.row.category,
		size: item.row.size,
		percent: item.row.percent,
		href: item.row.href,
		x,
		y: (y / TREEMAP_HEIGHT_UNITS) * 100,
		width,
		height: (height / TREEMAP_HEIGHT_UNITS) * 100
	}))

	const categoryTotal = Math.max(result.totals.bytes, 1)
	const categories: CategoryRow[] = [...result.categories]
		.map(([category, totals]) => ({
			category,
			label: CATEGORY_LABELS[category],
			size: totals.size,
			count: totals.count,
			percent: (totals.size / categoryTotal) * 100
		}))
		.sort((a, b) => b.size - a.size)

	return {
		...base,
		ready: true,
		totalSize: result.root.size,
		crumbs,
		directoryPath: node.path,
		directorySize: node.size,
		rows: sorted.slice(0, MAX_ROWS),
		hidden: { files: node.ownFiles - node.files.length, size: node.ownSize - shownFileSize },
		truncated: Math.max(0, sorted.length - MAX_ROWS),
		treemap,
		categories
	}
}
