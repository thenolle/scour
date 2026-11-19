import { statSync } from 'node:fs'
import { describe } from '../cleaner/errors'
import type { UninstallMode } from '../shared/program-view'
import { runPowerShell } from './powershell'
import type { Program } from './programs'

export interface CommandPlan {
  readonly file: string
  readonly args: string
  readonly display: string
}

const RUN_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  'try {',
  '  if ($env:SCOUR_ARGS) { $p = Start-Process -FilePath $env:SCOUR_FILE -ArgumentList $env:SCOUR_ARGS -Wait -PassThru }',
  '  else { $p = Start-Process -FilePath $env:SCOUR_FILE -Wait -PassThru }',
  '  exit $p.ExitCode',
  '} catch {',
  '  [Console]::Error.WriteLine($_.Exception.Message)',
  '  exit 1',
  '}'
].join('\n')

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function expandEnvironment(value: string): string {
  return value.replace(/%([^%]+)%/g, (whole: string, name: string) => process.env[name] ?? whole)
}

function plan(file: string, args: string): CommandPlan {
  return { file, args, display: args === '' ? file : `${file} ${args}` }
}

/** Splits a registry command line into the program and its arguments, tolerating unquoted paths with spaces. */
export function splitCommand(line: string): CommandPlan | null {
  const value = expandEnvironment(line).trim()
  if (value === '') return null
  if (value.startsWith('"')) {
    const end = value.indexOf('"', 1)
    return end < 0 ? null : plan(value.slice(1, end), value.slice(end + 1).trim())
  }
  const tokens = value.split(' ')
  for (let count = tokens.length; count >= 1; count -= 1) {
    const candidate = tokens.slice(0, count).join(' ')
    const rest = tokens.slice(count).join(' ')
    if (isFile(candidate)) return plan(candidate, rest)
    if (isFile(`${candidate}.exe`)) return plan(`${candidate}.exe`, rest)
  }
  const first = tokens[0]
  return first === undefined || first === '' ? null : plan(first, tokens.slice(1).join(' '))
}

/** Decides what to run. Silent mode needs a quiet command or a Windows Installer product. */
export function planUninstall(program: Program, mode: UninstallMode): CommandPlan | null {
  if (program.productCode !== null) return plan('msiexec.exe', mode === 'silent' ? `/x ${program.productCode} /qn /norestart` : `/x ${program.productCode}`)
  if (mode === 'silent') return program.quietUninstallString === '' ? null : splitCommand(program.quietUninstallString)
  return splitCommand(program.uninstallString === '' ? program.quietUninstallString : program.uninstallString)
}

/** Runs the plan and waits for it to finish. Never throws. */
export async function runPlan(target: CommandPlan): Promise<{ readonly exitCode: number; readonly error: string | null }> {
  try {
    const result = await runPowerShell(RUN_SCRIPT, { SCOUR_FILE: target.file, SCOUR_ARGS: target.args })
    const message = result.stderr.trim()
    return { exitCode: result.exitCode, error: result.exitCode !== 0 && message !== '' ? message : null }
  } catch (error) {
    return { exitCode: 1, error: describe(error) }
  }
}
