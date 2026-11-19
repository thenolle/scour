import { stat, statfs } from 'node:fs/promises'
import type { DriveInfo } from '../shared/scan-view'

async function inspect(path: string): Promise<DriveInfo | null> {
	try {
		if (!(await stat(path)).isDirectory()) return null
	} catch {
		return null
	}
	let totalBytes: number | null = null
	let freeBytes: number | null = null
	try {
		const space = await statfs(path)
		totalBytes = space.blocks * space.bsize
		freeBytes = space.bavail * space.bsize
	} catch {
		totalBytes = null
		freeBytes = null
	}
	return { path, totalBytes, freeBytes }
}

/** Lists the drive roots that exist, with their capacity when it can be read. */
export async function listDrives(): Promise<DriveInfo[]> {
	const roots = process.platform === 'win32' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `${letter}:\\`) : ['/']
	const found = await Promise.all(roots.map((root) => inspect(root)))
	return found.filter((drive): drive is DriveInfo => drive !== null)
}

/** Keeps the last drive listing so page loaders can read it without waiting. */
export class DriveCatalog {
	private drives: readonly DriveInfo[] = []

	snapshot(): readonly DriveInfo[] {
		return this.drives
	}

	async refresh(): Promise<void> {
		this.drives = await listDrives()
	}
}
