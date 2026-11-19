import type { ScanEvent } from '../shared/events'
import { formatBytes, formatCount } from '../shared/format'

const MIN_DELAY_MS = 500
const MAX_DELAY_MS = 8000

function setText(name: string, value: string): void {
	for (const element of document.querySelectorAll(`[data-live="${name}"]`)) element.textContent = value
}

function isScanEvent(value: unknown): value is ScanEvent {
	return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string' && 'id' in value && typeof value.id === 'string'
}

function apply(root: HTMLElement, event: ScanEvent): void {
	if (event.id !== root.dataset['scanId']) return
	switch (event.type) {
		case 'progress':
			setText('files', formatCount(event.progress.files))
			setText('directories', formatCount(event.progress.directories))
			setText('bytes', formatBytes(event.progress.bytes))
			setText('errors', formatCount(event.progress.errors))
			setText('path', event.progress.currentPath)
			return
		case 'status':
			if (event.status !== 'running' && root.dataset['scanStatus'] === 'running') location.reload()
			return
		case 'duplicates':
			setText('dup-progress', `${formatCount(event.done)} of ${formatCount(event.total)} files checked`)
			if (event.status !== 'running' && root.dataset['dupStatus'] === 'running') location.reload()
			return
	}
}

async function reloadIfStale(root: HTMLElement): Promise<void> {
	try {
		const response = await fetch(`/api/scans/${encodeURIComponent(root.dataset['scanId'] ?? '')}`)
		const body: unknown = await response.json()
		if (typeof body !== 'object' || body === null || !('data' in body)) return
		const data = body.data
		if (typeof data !== 'object' || data === null) return
		const status = 'status' in data ? data.status : undefined
		const duplicates = 'duplicates' in data ? data.duplicates : undefined
		if (status !== root.dataset['scanStatus'] || duplicates !== root.dataset['dupStatus']) location.reload()
	} catch {
		return
	}
}

/**
 * On a scan page, listens for live events and updates the progress counters.
 * The page reloads when the scan or the duplicate search finishes.
 */
export function startLive(): void {
	const root = document.querySelector<HTMLElement>('[data-scan-id]')
	if (root === null) return
	let delay = MIN_DELAY_MS
	const connect = (): void => {
		const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
		socket.addEventListener('open', () => {
			delay = MIN_DELAY_MS
			void reloadIfStale(root)
		})
		socket.addEventListener('message', (message: MessageEvent<unknown>) => {
			if (typeof message.data !== 'string') return
			try {
				const value: unknown = JSON.parse(message.data)
				if (isScanEvent(value)) apply(root, value)
			} catch {
				return
			}
		})
		socket.addEventListener('close', () => {
			setTimeout(connect, delay)
			delay = Math.min(delay * 2, MAX_DELAY_MS)
		})
	}
	connect()
}
