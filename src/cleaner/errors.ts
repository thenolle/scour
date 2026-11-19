/** Thrown for problems the user can act on, such as an empty selection. */
export class CleanerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CleanerError'
  }
}

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
