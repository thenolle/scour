import type { ScanEvent } from '../shared/events'
import { formatBytes, formatCount } from '../shared/format'

const MIN_DELAY_MS = 500
const MAX_DELAY_MS = 8000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function setText(name: string, value: string): void {
  for (const element of document.querySelectorAll(`[data-live="${name}"]`)) element.textContent = value
}

function isScanEvent(value: unknown): value is ScanEvent {
  return isRecord(value) && typeof value['type'] === 'string' && typeof value['id'] === 'string'
}

function apply(root: HTMLElement, event: ScanEvent): void {
  if (event.id !== (root.dataset['scanId'] ?? root.dataset['jobId'])) return
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
    case 'job':
      if (event.status !== 'running' && root.dataset['jobStatus'] === 'running') location.reload()
      return
  }
}

async function fetchData(url: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url)
  const body: unknown = await response.json()
  if (!isRecord(body)) return null
  const data = body['data']
  return isRecord(data) ? data : null
}

async function reloadIfStale(root: HTMLElement): Promise<void> {
  try {
    const scanId = root.dataset['scanId']
    if (scanId !== undefined) {
      const data = await fetchData(`/api/scans/${encodeURIComponent(scanId)}`)
      if (data !== null && (data['status'] !== root.dataset['scanStatus'] || data['duplicates'] !== root.dataset['dupStatus'])) location.reload()
      return
    }
    const jobId = root.dataset['jobId']
    if (jobId === undefined) return
    const data = await fetchData(`/api/programs/${encodeURIComponent(jobId)}`)
    if (data === null) return
    const job = data['job']
    if ((isRecord(job) ? job['status'] : 'none') !== (root.dataset['jobStatus'] ?? 'none')) location.reload()
  } catch {
    return
  }
}

/**
 * On a scan or program page, listens for live events and updates the progress
 * counters. The page reloads when the scan, duplicate search or uninstall ends.
 */
export function startLive(): void {
  const root = document.querySelector<HTMLElement>('[data-scan-id], [data-job-id]')
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
