import { redirect } from '@gambrel/core'
import type { App } from '@gambrel/core'
import { CleanerError } from '../cleaner/errors'
import { buildSnapshotListView } from '../snapshots/view'
import { jsonResponse } from './responses'
import type { AppServices } from './services'

/** Form actions for the snapshot pages, plus one read-only JSON endpoint. */
export function registerSnapshotRoutes(app: App, services: AppServices): void {
  const { snapshots } = services
  const detail = (id: string): string => `/snapshots/${encodeURIComponent(id)}`
  const finish = async (path: string, work: () => Promise<unknown>): Promise<Response> => {
    try {
      await work()
    } catch (error) {
      if (!(error instanceof CleanerError)) throw error
      snapshots.fail(error.message)
    }
    return redirect(path, 303)
  }

  app.get('/api/snapshots', () => jsonResponse({ data: buildSnapshotListView(snapshots, null).snapshots }))

  app.post('/actions/snapshots/create', async (context) => {
    const form = await context.request.formData()
    const name = form.get('name')
    try {
      const meta = await snapshots.create(typeof name === 'string' ? name : '')
      return redirect(detail(meta.id), 303)
    } catch (error) {
      if (!(error instanceof CleanerError)) throw error
      snapshots.fail(error.message)
      return redirect('/snapshots', 303)
    }
  })

  app.post('/actions/snapshots/:id/compare', (context) =>
    finish(detail(context.params.id), async () => {
      snapshots.compare(context.params.id)
    })
  )

  app.post('/actions/snapshots/:id/remove', async (context) => {
    const form = await context.request.formData()
    const ids = form.getAll('item').filter((value): value is string => typeof value === 'string')
    return finish(detail(context.params.id), () => snapshots.removeAdded(context.params.id, ids, form.get('mode') === 'all'))
  })

  app.post('/actions/snapshots/:id/delete', async (context) => {
    try {
      await snapshots.delete(context.params.id)
      return redirect('/snapshots', 303)
    } catch (error) {
      if (!(error instanceof CleanerError)) throw error
      snapshots.fail(error.message)
      return redirect(detail(context.params.id), 303)
    }
  })
}
