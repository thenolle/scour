const PROTECTED_NAMES: ReadonlySet<string> = new Set([
  'microsoft', 'microsoftcorporation', 'windows', 'windowsnt', 'commonfiles', 'windowsapps', 'packages', 'temp', 'programs',
  'internetexplorer', 'windowsdefender', 'modifiablewindowsapps', 'classes', 'policies', 'wow6432node', 'default', 'public', 'allusers'
])

const COMPANY_SUFFIX = /\b(inc|llc|ltd|corp|corporation|gmbh|co|company|limited|sa|ag)\b\.?/gi

/** Lower-cases a name and drops everything except letters and digits. */
export function normalizeName(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function isProtectedName(name: string): boolean {
  return PROTECTED_NAMES.has(normalizeName(name))
}

/** The forms a program's folder or registry key is likely to use. Short names are skipped. */
export function nameForms(name: string): string[] {
  const cleaned = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(x64|x86|64-bit|32-bit)\b/gi, ' ')
    .replace(/\bv?\d+(\.\d+)+\b/g, ' ')
    .replace(/\s+\d+\s*$/, ' ')
  return [...new Set([normalizeName(name), normalizeName(cleaned)])].filter((form) => form.length >= 4 && !PROTECTED_NAMES.has(form))
}

export function publisherForm(publisher: string): string | null {
  const form = normalizeName(publisher.replace(COMPANY_SUFFIX, ' '))
  return form.length >= 4 && !PROTECTED_NAMES.has(form) ? form : null
}

export function hashId(...parts: readonly string[]): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(parts.join('\u0000').toLowerCase())
  return hasher.digest('hex').slice(0, 16)
}
