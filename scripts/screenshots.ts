import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const port = 4899
const base = `http://127.0.0.1:${port}`
const outputDirectory = join(root, 'screenshots')

const BROWSERS: readonly (string | undefined)[] = [
  process.env['SCOUR_BROWSER'],
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1900 },
  { name: 'mobile', width: 390, height: 2600 }
] as const

const THEMES = [
  { name: 'light', dark: false },
  { name: 'dark', dark: true }
] as const

function findBrowser(): string {
  for (const candidate of BROWSERS) {
    if (candidate !== undefined && candidate !== '' && existsSync(candidate)) return candidate
  }
  throw new Error('No Edge or Chrome found. Set SCOUR_BROWSER to the path of its executable.')
}

async function attempt<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read()
  } catch {
    return null
  }
}

async function waitFor<T>(label: string, read: () => Promise<T | null>, timeoutMs = 90_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await attempt(read)
    if (value !== null) return value
    await Bun.sleep(300)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function getData(path: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${base}${path}`)
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('data' in body)) return null
  const data = body.data
  return typeof data === 'object' && data !== null ? Object.fromEntries(Object.entries(data)) : null
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

async function startScan(): Promise<string> {
  const response = await fetch(`${base}/api/scans`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: root })
  })
  if (!response.ok) throw new Error(`Starting a scan failed: ${response.status} ${await response.text()}`)
  const body: unknown = await response.json()
  const data = typeof body === 'object' && body !== null && 'data' in body && typeof body.data === 'object' && body.data !== null ? Object.fromEntries(Object.entries(body.data)) : null
  const id = data === null ? null : readString(data, 'id')
  if (id === null) throw new Error('The scan response had no id')
  return id
}

async function capture(browser: string, profile: string, url: string, file: string, width: number, height: number, dark: boolean): Promise<void> {
  const args = [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--virtual-time-budget=4000', `--screenshot=${file}`]
  if (dark) args.push('--blink-settings=preferredColorScheme=1')
  args.push(url)
  const child = Bun.spawn(args, { stdout: 'ignore', stderr: 'ignore' })
  await child.exited
  if (!(await Bun.file(file).exists())) throw new Error(`The browser did not write ${file}`)
}

async function main(): Promise<void> {
  const browser = findBrowser()
  const dataDirectory = await mkdtemp(join(tmpdir(), 'scour-shots-'))
  const profile = await mkdtemp(join(tmpdir(), 'scour-profile-'))
  await mkdir(outputDirectory, { recursive: true })

  const server = Bun.spawn([process.execPath, 'dist/server/index.js'], {
    cwd: root,
    stdout: 'ignore',
    stderr: 'inherit',
    env: { ...process.env, SCOUR_PORT: String(port), SCOUR_DATA_DIRECTORY: dataDirectory }
  })

  try {
    await waitFor('the server', async () => ((await fetch(`${base}/api/health`)).ok ? true : null))

    const id = await startScan()
    await waitFor('the scan', async () => {
      const data = await getData(`/api/scans/${id}`)
      return data !== null && readString(data, 'status') === 'completed' ? true : null
    })
    await fetch(`${base}/api/scans/${id}/duplicates`, { method: 'POST' })
    await waitFor('the duplicate search', async () => {
      const data = await getData(`/api/scans/${id}`)
      const status = data === null ? null : readString(data, 'duplicates')
      return status === 'completed' || status === 'failed' ? true : null
    })

    const form = new FormData()
    form.set('scan', id)
    await fetch(`${base}/actions/cleaner/detect`, { method: 'POST', body: form, redirect: 'manual' })

    const pages: { readonly name: string; readonly path: string }[] = [
      { name: 'drives', path: '/' },
      { name: 'scan', path: `/scan/${id}` },
      { name: 'cleaner', path: '/cleaner' }
    ]
    if ((await fetch(`${base}/programs`)).ok) pages.push({ name: 'programs', path: '/programs' })

    const written: string[] = []
    for (const page of pages) {
      for (const viewport of VIEWPORTS) {
        for (const theme of THEMES) {
          const file = join(outputDirectory, `${page.name}-${theme.name}-${viewport.name}.png`)
          await capture(browser, profile, `${base}${page.path}`, file, viewport.width, viewport.height, theme.dark)
          written.push(file)
        }
      }
    }
    console.log(`Wrote ${written.length} screenshots to ${outputDirectory}`)
  } finally {
    server.kill()
    await server.exited
    await rm(dataDirectory, { recursive: true, force: true })
    await rm(profile, { recursive: true, force: true })
  }
}

main().catch((error: unknown) => {
  console.error('[screenshots]', error instanceof Error ? error.message : error)
  process.exit(1)
})
