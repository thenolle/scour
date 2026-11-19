import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import type { ScanEvent } from '../shared/events'
import { EMPTY_PROGRESS } from '../shared/scan-view'
import type { DuplicateStatus, ScanProgress, ScanStatus } from '../shared/scan-view'
import { ScanCancelled } from './cancel'
import { findDuplicates } from './duplicates'
import type { DuplicateGroup } from './duplicates'
import { scanDirectory } from './scanner'
import type { ScanResult } from './scanner'

const KEEP_FILES = 100
const DUPLICATE_MIN_SIZE = 1024 * 1024
const MAX_SESSIONS = 8
const MAX_RUNNING = 2
const DUPLICATE_EVENT_INTERVAL_MS = 150

/** Thrown when the requested scan root is missing, relative or not a folder. */
export class ScanInputError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ScanInputError'
	}
}

export interface DuplicatesState {
	status: DuplicateStatus
	done: number
	total: number
	groups: DuplicateGroup[]
	error: string | null
}

export class ScanSession {
	readonly controller = new AbortController()
	status: ScanStatus = 'running'
	progress: ScanProgress = EMPTY_PROGRESS
	result: ScanResult | null = null
	error: string | null = null
	finishedAt: number | null = null
	duplicates: DuplicatesState = { status: 'idle', done: 0, total: 0, groups: [], error: null }
	duplicateController: AbortController | null = null

	constructor(
		readonly id: string,
		readonly root: string,
		readonly startedAt: number
	) { }
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

async function normalizeRoot(input: string): Promise<string> {
	const trimmed = input.trim().replace(/^"(.*)"$/, '$1')
	if (trimmed === '') throw new ScanInputError('Enter a folder or drive to scan.')
	const candidate = /^[A-Za-z]:$/.test(trimmed) ? `${trimmed}\\` : trimmed
	if (!isAbsolute(candidate)) throw new ScanInputError('Use an absolute path, such as C:\\Users.')
	const root = resolve(candidate)
	try {
		if (!(await stat(root)).isDirectory()) throw new ScanInputError(`${root} is not a folder.`)
	} catch (error) {
		if (error instanceof ScanInputError) throw error
		throw new ScanInputError(`${root} cannot be opened.`)
	}
	return root
}

/** Owns every scan in memory, runs them, and announces what happens. */
export class ScanManager {
	private readonly sessions = new Map<string, ScanSession>()
	private readonly listeners = new Set<(event: ScanEvent) => void>()

	subscribe(listener: (event: ScanEvent) => void): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	list(): ScanSession[] {
		return [...this.sessions.values()].reverse()
	}

	get(id: string): ScanSession | undefined {
		return this.sessions.get(id)
	}

	async start(input: string): Promise<ScanSession> {
		const root = await normalizeRoot(input)
		const running = this.list().filter((session) => session.status === 'running').length
		if (running >= MAX_RUNNING) throw new ScanInputError(`Only ${MAX_RUNNING} scans can run at once. Cancel one or wait for it to finish.`)
		const session = new ScanSession(crypto.randomUUID(), root, Date.now())
		this.sessions.set(session.id, session)
		this.evict()
		void this.run(session)
		return session
	}

	cancel(id: string): boolean {
		const session = this.sessions.get(id)
		if (session === undefined) return false
		if (session.status === 'running') {
			session.controller.abort()
			return true
		}
		if (session.duplicateController !== null) {
			session.duplicateController.abort()
			return true
		}
		return false
	}

	cancelAll(): void {
		for (const session of this.sessions.values()) {
			session.controller.abort()
			session.duplicateController?.abort()
		}
	}

	startDuplicates(id: string): boolean {
		const session = this.sessions.get(id)
		const result = session?.result ?? null
		if (session === undefined || result === null || session.duplicates.status === 'running') return false
		void this.runDuplicates(session, result)
		return true
	}

	private publish(event: ScanEvent): void {
		for (const listener of this.listeners) listener(event)
	}

	private publishDuplicates(session: ScanSession): void {
		const { status, done, total } = session.duplicates
		this.publish({ type: 'duplicates', id: session.id, status, done, total })
	}

	private evict(): void {
		for (const [id, session] of this.sessions) {
			if (this.sessions.size <= MAX_SESSIONS) return
			if (session.status !== 'running') this.sessions.delete(id)
		}
	}

	private async run(session: ScanSession): Promise<void> {
		this.publish({ type: 'status', id: session.id, status: 'running' })
		try {
			session.result = await scanDirectory(session.root, {
				signal: session.controller.signal,
				keepFiles: KEEP_FILES,
				duplicateMinSize: DUPLICATE_MIN_SIZE,
				onProgress: (progress) => {
					session.progress = progress
					this.publish({ type: 'progress', id: session.id, progress })
				}
			})
			session.status = 'completed'
		} catch (error) {
			if (error instanceof ScanCancelled) session.status = 'cancelled'
			else {
				session.status = 'failed'
				session.error = describe(error)
			}
		}
		session.finishedAt = Date.now()
		this.publish({ type: 'status', id: session.id, status: session.status })
	}

	private async runDuplicates(session: ScanSession, result: ScanResult): Promise<void> {
		const controller = new AbortController()
		session.duplicateController = controller
		session.duplicates = { status: 'running', done: 0, total: 0, groups: [], error: null }
		this.publishDuplicates(session)
		let lastEvent = 0
		try {
			const groups = await findDuplicates(result.candidates, {
				signal: controller.signal,
				onProgress: (done, total) => {
					session.duplicates.done = done
					session.duplicates.total = total
					const now = Date.now()
					if (now - lastEvent < DUPLICATE_EVENT_INTERVAL_MS) return
					lastEvent = now
					this.publishDuplicates(session)
				}
			})
			session.duplicates = { status: 'completed', done: session.duplicates.total, total: session.duplicates.total, groups, error: null }
		} catch (error) {
			const cancelled = error instanceof ScanCancelled
			session.duplicates = { ...session.duplicates, status: cancelled ? 'cancelled' : 'failed', error: cancelled ? null : describe(error) }
		}
		session.duplicateController = null
		this.publishDuplicates(session)
	}
}
