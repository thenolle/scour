/** Runs `task` over `items` with at most `limit` running at once, keeping input order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const queue = items.map((item, index) => ({ item, index }))
  const results: R[] = new Array<R>(items.length)
  const worker = async (): Promise<void> => {
    for (;;) {
      const next = queue.shift()
      if (next === undefined) return
      results[next.index] = await task(next.item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}
