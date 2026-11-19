import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const STAT_BATCH = 64

export interface Measure {
	readonly bytes: number
	readonly files: number
}

interface Totals {
	bytes: number
	files: number
}

async function walk(directory: string, totals: Totals): Promise<void> {
	let entries
	try {
		entries = await readdir(directory, { withFileTypes: true })
	} catch {
		return
	}
	const files: string[] = []
	const directories: string[] = []
	for (const entry of entries) {
		if (entry.isSymbolicLink()) continue
		if (entry.isDirectory()) directories.push(join(directory, entry.name))
		else if (entry.isFile()) files.push(join(directory, entry.name))
	}
	for (let start = 0; start < files.length; start += STAT_BATCH) {
		const sizes = await Promise.all(
			files.slice(start, start + STAT_BATCH).map(async (file) => {
				try {
					return (await lstat(file)).size
				} catch {
					return null
				}
			})
		)
		for (const size of sizes) {
			if (size === null) continue
			totals.bytes += size
			totals.files += 1
		}
	}
	for (const child of directories) await walk(child, totals)
}

/**
 * Measures a file or folder. Returns null when the path does not exist or is a
 * link. Links inside a folder are not followed.
 */
export async function measurePath(path: string): Promise<Measure | null> {
	let stats
	try {
		stats = await lstat(path)
	} catch {
		return null
	}
	if (stats.isSymbolicLink()) return null
	if (!stats.isDirectory()) return { bytes: stats.size, files: 1 }
	const totals: Totals = { bytes: 0, files: 0 }
	await walk(path, totals)
	return totals
}
