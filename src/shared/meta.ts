export const APP_NAME = 'scour'
export const APP_VERSION = '0.0.0'

/**
 * Runtime facts shown on the status page and returned by `/api/health`.
 * Declared as a type alias, not an interface, so it satisfies the router's
 * `JsonValue` constraint on loader data.
 */
export type HealthInfo = {
  readonly status: 'ok'
  readonly name: string
  readonly version: string
  readonly platform: string
  readonly bun: string
}

export function collectHealth(): HealthInfo {
  return {
    status: 'ok',
    name: APP_NAME,
    version: APP_VERSION,
    platform: process.platform,
    bun: Bun.version
  }
}
