import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Category, ScanProgress } from '../shared/scan-view'
import { ScanCancelled } from './cancel'
import { categorize } from './categories'
import { DirNode } from './tree'

const STAT_BATCH = 64
const PROGRESS_INTERVAL_MS = 120

export interface CategoryTotals {
	size: number
	count: number
}

export interface ScanOptions {
	readonly signal: AbortSignal
	readonly keepFiles: number
	readonly duplicateMinSize: number
	readonly onProgress: (progress: ScanProgress) => void
}

export interface ScanResult {
	readonly root: DirNode
	readonly index: ReadonlyMap<string, DirNode>
	readonly categories: ReadonlyMap<Category, CategoryTotals>
	readonly candidates: ReadonlyMap<number, string[]>
	readonly totals: { readonly files: number; readonly directories: number; readonly bytes: number; readonly errors: number }
}

interface FileStat {
	readonly size: number
	readonly modified: number
}

class Walker {
	readonly index = new Map<string, DirNode>()
	readonly categories = new Map<Category, CategoryTotals>()
	readonly candidates = new Map<number, string[]>()
	files = 0
	directories = 0
	bytes = 0
	errors = 0
	private lastEmit = 0
	private readonly options: ScanOptions

	constructor(options: ScanOptions) {
		this.options = options
	}

	emit(currentPath: string, force = false): void {
		const now = Date.now()
		if (!force && now - this.lastEmit < PROGRESS_INTERVAL_MS) return
		this.lastEmit = now
		this.options.onProgress({ files: this.files, directories: this.directories, bytes: this.bytes, errors: this.errors, currentPath })
	}

	async walk(node: DirNode): Promise<void> {
		if (this.options.signal.aborted) throw new ScanCancelled()
		this.index.set(node.path, node)
		this.directories += 1
		this.emit(node.path)

		let entries
		try {
			entries = await readdir(node.path, { withFileTypes: true })
		} catch {
			this.errors += 1
			return
		}

		const fileNames: string[] = []
		const directoryNames: string[] = []
		for (const entry of entries) {
			if (entry.isSymbolicLink()) continue
			if (entry.isDirectory()) directoryNames.push(entry.name)
			else if (entry.isFile()) fileNames.push(entry.name)
		}

		for (let start = 0; start < fileNames.length; start += STAT_BATCH) {
			if (this.options.signal.aborted) throw new ScanCancelled()
			const batch = fileNames.slice(start, start + STAT_BATCH)
			const stats = await Promise.all(batch.map((name) => this.stat(join(node.path, name))))
			batch.forEach((name, offset) => {
				const stat = stats[offset]
				if (stat !== undefined && stat !== null) this.addFile(node, name, stat)
			})
		}

		node.files.sort((a, b) => b.size - a.size)
		if (node.files.length > this.options.keepFiles) node.files.length = this.options.keepFiles

		for (const name of directoryNames) {
			const child = new DirNode(join(node.path, name), name, node)
			node.children.push(child)
			await this.walk(child)
		}

		node.size = node.ownSize
		node.fileCount = node.ownFiles
		for (const child of node.children) {
			node.size += child.size
			node.fileCount += child.fileCount
		}
	}

	private async stat(path: string): Promise<FileStat | null> {
		try {
			const stats = await lstat(path)
			return { size: stats.size, modified: stats.mtimeMs }
		} catch {
			this.errors += 1
			return null
		}
	}

	private addFile(node: DirNode, name: string, stat: FileStat): void {
		node.ownSize += stat.size
		node.ownFiles += 1
		node.files.push({ name, size: stat.size, modified: stat.modified })
		this.files += 1
		this.bytes += stat.size

		const category = categorize(name)
		const totals = this.categories.get(category)
		if (totals === undefined) this.categories.set(category, { size: stat.size, count: 1 })
		else {
			totals.size += stat.size
			totals.count += 1
		}

		if (stat.size >= this.options.duplicateMinSize) {
			const path = join(node.path, name)
			const group = this.candidates.get(stat.size)
			if (group === undefined) this.candidates.set(stat.size, [path])
			else group.push(path)
		}
	}
}

/**
 * Walks a directory tree and returns per-folder totals, category totals and
 * the files large enough to be checked for duplicates. Symbolic links and
 * junctions are not followed. Unreadable entries are counted, not fatal.
 */
export async function scanDirectory(rootPath: string, options: ScanOptions): Promise<ScanResult> {
	const root = new DirNode(rootPath, rootPath, null)
	const walker = new Walker(options)
	await walker.walk(root)
	walker.emit(rootPath, true)
	return {
		root,
		index: walker.index,
		categories: walker.categories,
		candidates: walker.candidates,
		totals: { files: walker.files, directories: walker.directories, bytes: walker.bytes, errors: walker.errors }
	}
}
