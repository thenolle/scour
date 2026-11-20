import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { CleanerError, describe } from '../cleaner/errors'
import { isProtectedName } from './names'
import { isRecord } from './programs'
import { runProcess } from './powershell'

const KEY_PATTERN = /^(HKCU|HKLM)\\SOFTWARE\\(.+)$/i
const UNINSTALL_PATTERN = /^Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+$/i

export interface BackupEntry {
	readonly key: string
	readonly file: string
	deleted: boolean
}

export interface BackupManifest {
	readonly version: 1
	readonly id: string
	readonly createdAt: number
	readonly programName: string
	entries: BackupEntry[]
}

export interface RemoveKeysReport {
	readonly backupId: string | null
	readonly deleted: readonly string[]
	readonly failed: readonly { readonly key: string; readonly message: string }[]
}

/** Only an uninstall entry or a single vendor key under SOFTWARE may be removed. */
export function assertSafeKey(key: string, deep = false): void {
	const match = KEY_PATTERN.exec(key)
	const hive = match?.[1]
	const rest = match?.[2]
	if (hive === undefined || rest === undefined) throw new CleanerError(`Refusing to touch ${key}.`)
	const relative = hive.toUpperCase() === 'HKLM' ? rest.replace(/^WOW6432Node\\/i, '') : rest
	const isUninstall = UNINSTALL_PATTERN.test(relative)
	const vendor = relative.split('\\')[0] ?? ''
	const isVendor = deep ? !isProtectedName(vendor) : !relative.includes('\\') && !isProtectedName(relative)
	if (!isUninstall && !isVendor) throw new CleanerError(`Refusing to touch ${key}: only an uninstall entry or a vendor key may be removed.`)
}

function parseManifest(value: unknown): BackupManifest | null {
	if (!isRecord(value) || value['version'] !== 1) return null
	const id = value['id']
	const createdAt = value['createdAt']
	const programName = value['programName']
	const raw = value['entries']
	if (typeof id !== 'string' || basename(id) !== id || typeof createdAt !== 'number' || typeof programName !== 'string' || !Array.isArray(raw)) return null
	const entries: BackupEntry[] = []
	for (const item of raw) {
		if (!isRecord(item) || typeof item['key'] !== 'string' || typeof item['file'] !== 'string' || typeof item['deleted'] !== 'boolean' || basename(item['file']) !== item['file']) return null
		entries.push({ key: item['key'], file: item['file'], deleted: item['deleted'] })
	}
	return { version: 1, id, createdAt, programName, entries }
}

/** Exports each registry key to a `.reg` file before deleting it, and can import the files back. */
export class RegistrySurgeon {
	private readonly backups = new Map<string, BackupManifest>()

	constructor(private readonly directory: string) { }

	async load(): Promise<void> {
		this.backups.clear()
		let names: string[]
		try {
			names = await readdir(this.directory)
		} catch {
			return
		}
		for (const name of names) {
			try {
				const manifest = parseManifest(await Bun.file(join(this.directory, name, 'manifest.json')).json())
				if (manifest !== null && manifest.id === name) this.backups.set(name, manifest)
			} catch {
				continue
			}
		}
	}

	list(): BackupManifest[] {
		return [...this.backups.values()].sort((a, b) => b.createdAt - a.createdAt)
	}

	async removeKeys(programName: string, keys: readonly string[], deep = false): Promise<RemoveKeysReport> {
		for (const key of keys) assertSafeKey(key, deep)
		const manifest: BackupManifest = { version: 1, id: crypto.randomUUID(), createdAt: Date.now(), programName, entries: [] }
		const directory = join(this.directory, manifest.id)
		await mkdir(directory, { recursive: true })
		const deleted: string[] = []
		const failed: { key: string; message: string }[] = []
		for (const [index, key] of keys.entries()) {
			try {
				const file = join(directory, `${index}.reg`)
				const exported = await runProcess(['reg.exe', 'export', key, file, '/y'])
				if (exported.exitCode !== 0 || !(await Bun.file(file).exists())) throw new Error(`Backup failed: ${exported.stderr.trim() || 'the key could not be exported'}`)
				const entry: BackupEntry = { key, file: basename(file), deleted: false }
				manifest.entries.push(entry)
				await this.save(directory, manifest)
				const removed = await runProcess(['reg.exe', 'delete', key, '/f'])
				if (removed.exitCode !== 0) throw new Error(removed.stderr.trim() || 'the key could not be deleted')
				entry.deleted = true
				await this.save(directory, manifest)
				deleted.push(key)
			} catch (error) {
				failed.push({ key, message: describe(error) })
			}
		}
		if (manifest.entries.length === 0) {
			await rm(directory, { recursive: true, force: true })
			return { backupId: null, deleted, failed }
		}
		this.backups.set(manifest.id, manifest)
		return { backupId: manifest.id, deleted, failed }
	}

	async restore(id: string): Promise<{ readonly restored: number; readonly failed: readonly string[] }> {
		const manifest = this.backups.get(id)
		if (manifest === undefined) throw new CleanerError('That registry backup no longer exists.')
		let restored = 0
		const failed: string[] = []
		for (const entry of manifest.entries) {
			if (!entry.deleted) continue
			const imported = await runProcess(['reg.exe', 'import', join(this.directory, id, entry.file)])
			if (imported.exitCode === 0) restored += 1
			else failed.push(`${entry.key}: ${imported.stderr.trim() || 'import failed'}`)
		}
		return { restored, failed }
	}

	async discard(id: string): Promise<boolean> {
		if (!this.backups.has(id)) return false
		await rm(join(this.directory, id), { recursive: true, force: true })
		this.backups.delete(id)
		return true
	}

	private async save(directory: string, manifest: BackupManifest): Promise<void> {
		const target = join(directory, 'manifest.json')
		await Bun.write(`${target}.tmp`, JSON.stringify(manifest, null, 2))
		await rename(`${target}.tmp`, target)
	}
}
