export interface ProcessResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

/** Runs a program and collects its output. Arguments are an array, never a shell string. */
export async function runProcess(command: readonly string[], env: Record<string, string> = {}): Promise<ProcessResult> {
  const child = Bun.spawn([...command], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, ...env } })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { exitCode, stdout, stderr }
}

/** Runs a PowerShell script, sent encoded so quoting never matters. */
export function runPowerShell(script: string, env: Record<string, string> = {}): Promise<ProcessResult> {
  const encoded = Buffer.from(`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}`, 'utf16le').toString('base64')
  return runProcess(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], env)
}
