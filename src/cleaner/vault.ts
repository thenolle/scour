import { cp, lstat, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, parse } from 'node:path'
import type { Risk } from '../shared/cleaner-view'
import type { Candidate } from './detect'
import { CleanerError, describe } from './errors'

const DAY_MS = 24 * 60 * 60 * 1000
const MANIFEST = 'manifest.json'
const DATA = 'data'
const MIN_DEPTH = 3

export interface VaultItem {
	readonly storedName: string
	readonly originalPath: string
	readonly kind: 'file' | 'dir'
	readonly bytes: number
	readonly files: number
	readonly ruleId: string
	readonly risk: Risk
	readonly title: string
}

export interface VaultManifest {
	readonly version: 1
	readonly id: string
	readonly createdAt: number
	readonly expiresAt: number
	items: VaultItem[]
}

export interface VaultBatch {
	readonly root: string
	readonly manifest: VaultManifest
}

export interface MoveFailure {
	readonly path: string
	readonly message: string
}

export interface QuarantineReport {
	readonly moved: readonly VaultItem[]
	readonly failed: readonly MoveFailure[]
	readonly batchIds: readonly string[]
}

export interface RestoreReport {
	readonly restored: number
	readonly failed: readonly MoveFailure[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function isRisk(value: unknown): value is Risk {
	return value === 'safe' || value === 'redownloadable' || value === 'review'
}

function parseItem(value: unknown): VaultItem | null {
	if (!isRecord(value)) return null
	const storedName = value['storedName']
	const originalPath = value['originalPath']
	const kind = value['kind']
	const bytes = value['bytes']
	const files = value['files']
	const ruleId = value['ruleId']
	const risk = value['risk']
	const title = value['title']
	if (typeof storedName !== 'string' || typeof originalPath !== 'string') return null
	if (kind !== 'file' && kind !== 'dir') return null
	if (typeof bytes !== 'number' || typeof files !== 'number' || typeof ruleId !== 'string' || typeof title !== 'string') return null
	if (!isRisk(risk)) return null
	return { storedName, originalPath, kind, bytes, files, ruleId, risk, title }
}

function parseManifest(value: unknown): VaultManifest | null {
	if (!isRecord(value) || value['version'] !== 1) return null
	const id = value['id']
	const createdAt = value['createdAt']
	const expiresAt = value['expiresAt']
	const rawItems = value['items']
	if (typeof id !== 'string' || basename(id) !== id) return null
	if (typeof createdAt !== 'number' || typeof expiresAt !== 'number' || !Array.isArray(rawItems)) return null
	const items: VaultItem[] = []
	for (const raw of rawItems) {
		const item = parseItem(raw)
		if (item === null) return null
		items.push(item)
	}
	return { version: 1, id, createdAt, expiresAt, items }
}

async function readManifest(directory: string): Promise<VaultManifest | null> {
	try {
		const data: unknown = await Bun.file(join(directory, MANIFEST)).json()
		const manifest = parseManifest(data)
		return manifest !== null && manifest.id === basename(directory) ? manifest : null
	} catch {
		return null
	}
}

async function writeManifest(directory: string, manifest: VaultManifest): Promise<void> {
	const target = join(directory, MANIFEST)
	const temporary = `${target}.tmp`
	await Bun.write(temporary, JSON.stringify(manifest, null, 2))
	await rename(temporary, target)
}

function isCrossDevice(error: unknown): boolean {
	return error instanceof Error && 'code' in error && error.code === 'EXDEV'
}

async function moveEntry(from: string, to: string): Promise<void> {
	try {
		await rename(from, to)
		return
	} catch (error) {
		if (!isCrossDevice(error)) throw error
	}
	await cp(from, to, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false })
	try {
		await rm(from, { recursive: true, maxRetries: 3, retryDelay: 100 })
	} catch (error) {
		await rm(to, { recursive: true, force: true })
		throw error
	}
}

/** Refuses paths that are not absolute or sit too close to a drive root. */
export function assertSafeTarget(path: string): void {
	const root = parse(path).root
	const depth = path
		.slice(root.length)
		.split(/[\\/]+/)
		.filter((segment) => segment !== '').length
	if (!isAbsolute(path) || depth < MIN_DEPTH) throw new CleanerError(`Refusing to touch ${path}: it is too close to the drive root.`)
}

/**
 * Holds removed items for a while instead of deleting them. Each batch is a
 * folder with a `manifest.json` and a `data` folder. Batches live on the same
 * drive as the items they hold so moves are renames, not copies.
 */
export class Vault {
	private readonly batches = new Map<string, VaultBatch>()

	constructor(
		private readonly dataDirectory: string,
		readonly retentionDays: number
	) { }

	/** The quarantine folder used for items on the same drive as `path`. */
	rootFor(path: string): string {
		const home = join(this.dataDirectory, 'quarantine')
		if (process.platform !== 'win32') return home
		const drive = parse(path).root
		return drive.toLowerCase() === parse(this.dataDirectory).root.toLowerCase() ? home : join(drive, '.scour', 'quarantine')
	}

	/** Reads every batch from disk. Call once at startup. */
	async load(driveRoots: readonly string[]): Promise<void> {
		const roots = new Set<string>([join(this.dataDirectory, 'quarantine'), ...driveRoots.map((drive) => join(drive, '.scour', 'quarantine'))])
		this.batches.clear()
		for (const root of roots) {
			let names: string[]
			try {
				names = await readdir(root)
			} catch {
				continue
			}
			for (const name of names) {
				const manifest = await readManifest(join(root, name))
				if (manifest !== null) this.batches.set(manifest.id, { root, manifest })
			}
		}
	}

	list(): VaultBatch[] {
		return [...this.batches.values()].sort((a, b) => b.manifest.createdAt - a.manifest.createdAt)
	}

	async quarantine(candidates: readonly Candidate[]): Promise<QuarantineReport> {
		const byRoot = new Map<string, Candidate[]>()
		for (const candidate of candidates) {
			assertSafeTarget(candidate.path)
			const root = this.rootFor(candidate.path)
			const group = byRoot.get(root)
			if (group === undefined) byRoot.set(root, [candidate])
			else group.push(candidate)
		}

		const moved: VaultItem[] = []
		const failed: MoveFailure[] = []
		const batchIds: string[] = []
		for (const [root, group] of byRoot) {
			const now = Date.now()
			const manifest: VaultManifest = { version: 1, id: crypto.randomUUID(), createdAt: now, expiresAt: now + this.retentionDays * DAY_MS, items: [] }
			const directory = join(root, manifest.id)
			try {
				await mkdir(join(directory, DATA), { recursive: true })
				await writeManifest(directory, manifest)
			} catch (error) {
				for (const candidate of group) failed.push({ path: candidate.path, message: `Quarantine folder unavailable: ${describe(error)}` })
				continue
			}
			for (const [index, candidate] of group.entries()) {
				try {
					const item = await this.moveIn(directory, index, candidate)
					manifest.items.push(item)
					await writeManifest(directory, manifest)
					moved.push(item)
				} catch (error) {
					failed.push({ path: candidate.path, message: describe(error) })
				}
			}
			if (manifest.items.length === 0) {
				await rm(directory, { recursive: true, force: true })
			} else {
				this.batches.set(manifest.id, { root, manifest })
				batchIds.push(manifest.id)
			}
		}
		return { moved, failed, batchIds }
	}

	async restore(id: string): Promise<RestoreReport> {
		const batch = this.batches.get(id)
		if (batch === undefined) throw new CleanerError('That quarantine batch no longer exists.')
		const directory = join(batch.root, id)
		const failed: MoveFailure[] = []
		let restored = 0
		for (const item of [...batch.manifest.items]) {
			try {
				await this.moveOut(directory, item)
				batch.manifest.items = batch.manifest.items.filter((other) => other !== item)
				await writeManifest(directory, batch.manifest)
				restored += 1
			} catch (error) {
				failed.push({ path: item.originalPath, message: describe(error) })
			}
		}
		if (batch.manifest.items.length === 0) {
			await rm(directory, { recursive: true, force: true })
			this.batches.delete(id)
		}
		return { restored, failed }
	}

	/** Deletes a batch for good. Returns false when the batch is unknown. */
	async purge(id: string): Promise<boolean> {
		const batch = this.batches.get(id)
		if (batch === undefined) return false
		await rm(join(batch.root, id), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
		this.batches.delete(id)
		return true
	}

	/** Deletes every batch whose retention period is over. Returns how many were removed. */
	async purgeExpired(now = Date.now()): Promise<number> {
		let purged = 0
		for (const batch of this.list()) {
			if (batch.manifest.expiresAt > now) continue
			if (await this.purge(batch.manifest.id)) purged += 1
		}
		return purged
	}

	private async moveIn(directory: string, index: number, candidate: Candidate): Promise<VaultItem> {
		const stats = await lstat(candidate.path)
		if (stats.isSymbolicLink()) throw new CleanerError('Links are not moved.')
		const storedName = `${index}-${basename(candidate.path)}`
		await moveEntry(candidate.path, join(directory, DATA, storedName))
		return {
			storedName,
			originalPath: candidate.path,
			kind: stats.isDirectory() ? 'dir' : 'file',
			bytes: candidate.bytes,
			files: candidate.files,
			ruleId: candidate.ruleId,
			risk: candidate.risk,
			title: candidate.title
		}
	}

	private async moveOut(directory: string, item: VaultItem): Promise<void> {
		if (basename(item.storedName) !== item.storedName) throw new CleanerError('The manifest entry is not valid.')
		assertSafeTarget(item.originalPath)
		try {
			await lstat(item.originalPath)
			throw new CleanerError('Something already exists at the original location.')
		} catch (error) {
			if (error instanceof CleanerError) throw error
		}
		await mkdir(dirname(item.originalPath), { recursive: true })
		await moveEntry(join(directory, DATA, item.storedName), item.originalPath)
	}
}
