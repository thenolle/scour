import { join } from 'node:path'
import { APP_VERSION } from '../src/shared/version'

const manifest: unknown = await Bun.file(join(import.meta.dir, '..', 'package.json')).json()
const declared = typeof manifest === 'object' && manifest !== null && 'version' in manifest ? manifest.version : undefined

if (declared !== APP_VERSION) {
  console.error(`package.json declares ${String(declared)} but src/shared/version.ts declares ${APP_VERSION}`)
  process.exit(1)
}
console.log(`Version ${APP_VERSION}`)
