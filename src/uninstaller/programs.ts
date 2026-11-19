import { hashId } from './names'
import { runPowerShell } from './powershell'

export interface Program {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly publisher: string
  readonly installDate: string
  readonly installLocation: string
  readonly keyPath: string
  readonly source: string
  readonly uninstallString: string
  readonly quietUninstallString: string
  readonly sizeBytes: number | null
  readonly productCode: string | null
}

const SCRIPT = [
  "$paths = @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
  '$items = @(Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue | Select-Object PSPath, PSChildName, DisplayName, DisplayVersion, Publisher, InstallLocation, InstallDate, UninstallString, QuietUninstallString, EstimatedSize, SystemComponent, WindowsInstaller, ParentKeyName, ReleaseType)',
  'ConvertTo-Json -InputObject $items -Compress -Depth 3'
].join('\n')

const MSI_COMMAND = /msiexec(?:\.exe)?"?\s+\/[ix]\s*(\{[0-9a-f-]{36}\})/i
const GUID = /^\{[0-9a-f-]{36}\}$/i

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

/** Converts `HKLM\...` to the form PowerShell's registry provider accepts. */
export function toProviderPath(keyPath: string): string {
  return `Registry::${keyPath.replace(/^HKLM\\/i, 'HKEY_LOCAL_MACHINE\\').replace(/^HKCU\\/i, 'HKEY_CURRENT_USER\\')}`
}

function keyPathOf(providerPath: string): string | null {
  const marker = providerPath.indexOf('::')
  if (marker < 0) return null
  const raw = providerPath.slice(marker + 2)
  if (raw.startsWith('HKEY_LOCAL_MACHINE\\')) return `HKLM\\${raw.slice('HKEY_LOCAL_MACHINE\\'.length)}`
  if (raw.startsWith('HKEY_CURRENT_USER\\')) return `HKCU\\${raw.slice('HKEY_CURRENT_USER\\'.length)}`
  return null
}

function parseProgram(raw: unknown): Program | null {
  if (!isRecord(raw)) return null
  const name = text(raw['DisplayName'])
  const uninstallString = text(raw['UninstallString'])
  const quietUninstallString = text(raw['QuietUninstallString'])
  const keyPath = keyPathOf(text(raw['PSPath']))
  if (name === '' || keyPath === null || (uninstallString === '' && quietUninstallString === '')) return null
  if (raw['SystemComponent'] === 1 || text(raw['ParentKeyName']) !== '' || /update|hotfix/i.test(text(raw['ReleaseType']))) return null

  const date = text(raw['InstallDate'])
  const size = raw['EstimatedSize']
  const childName = text(raw['PSChildName'])
  const productCode = MSI_COMMAND.exec(uninstallString)?.[1] ?? (raw['WindowsInstaller'] === 1 && GUID.test(childName) ? childName : null)
  return {
    id: hashId(keyPath),
    name,
    version: text(raw['DisplayVersion']),
    publisher: text(raw['Publisher']),
    installDate: /^\d{8}$/.test(date) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : date,
    installLocation: text(raw['InstallLocation']),
    keyPath,
    source: keyPath.startsWith('HKCU') ? 'Current user' : /\\WOW6432Node\\/i.test(keyPath) ? 'All users (32-bit)' : 'All users',
    uninstallString,
    quietUninstallString,
    sizeBytes: typeof size === 'number' && size > 0 ? size * 1024 : null,
    productCode
  }
}

/** Reads the installed programs from the three Uninstall registry hives. Returns an empty list off Windows. */
export async function listPrograms(): Promise<Program[]> {
  if (process.platform !== 'win32') return []
  const result = await runPowerShell(SCRIPT)
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `PowerShell exited with code ${result.exitCode}`)
  const output = result.stdout.trim()
  if (output === '') return []
  const data: unknown = JSON.parse(output)
  if (!Array.isArray(data)) return []
  const unique = new Map<string, Program>()
  for (const raw of data) {
    const program = parseProgram(raw)
    if (program !== null) unique.set(program.id, program)
  }
  return [...unique.values()]
}
