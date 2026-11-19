import { redirect } from '@gambrel/core'
import type { App } from '@gambrel/core'
import { CleanerError } from '../cleaner/errors'
import { buildProgramDetailView } from '../uninstaller/view'
import { errorResponse, jsonResponse } from './responses'
import type { AppServices } from './services'

/** Form actions for the programs pages, plus one read-only JSON endpoint used by live updates. */
export function registerUninstallerRoutes(app: App, services: AppServices): void {
  const { uninstaller } = services
  const detail = (id: string): string => `/programs/${encodeURIComponent(id)}`
  const finish = async (path: string, work: () => Promise<unknown>): Promise<Response> => {
    try {
      await work()
    } catch (error) {
      if (!(error instanceof CleanerError)) throw error
      uninstaller.fail(error.message)
    }
    return redirect(path, 303)
  }

  app.get('/api/programs/:id', (context) => {
    const view = buildProgramDetailView(uninstaller, context.params.id, null)
    return view === null ? errorResponse(404, 'not_found', 'Program not found') : jsonResponse({ data: view })
  })

  app.post('/actions/programs/refresh', () => finish('/programs', () => uninstaller.refresh()))

  app.post('/actions/programs/:id/uninstall', async (context) => {
    const form = await context.request.formData()
    const mode = form.get('mode') === 'silent' ? 'silent' : 'interactive'
    return finish(detail(context.params.id), async () => {
      uninstaller.startUninstall(context.params.id, mode)
    })
  })

  app.post('/actions/programs/:id/leftovers', (context) => finish(detail(context.params.id), () => uninstaller.scanLeftovers(context.params.id)))

  app.post('/actions/programs/:id/remove-leftovers', async (context) => {
    const form = await context.request.formData()
    const ids = form.getAll('leftover').filter((value): value is string => typeof value === 'string')
    return finish(detail(context.params.id), () => uninstaller.removeLeftovers(context.params.id, ids))
  })

  app.post('/actions/registry/:id/restore', (context) => finish('/programs', () => uninstaller.restoreBackup(context.params.id)))
  app.post('/actions/registry/:id/discard', (context) => finish('/programs', () => uninstaller.discardBackup(context.params.id)))
}
