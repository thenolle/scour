import { redirect } from '@gambrel/core'
import type { App } from '@gambrel/core'
import { CleanerError } from '../cleaner/errors'
import { buildCleanerView, toBatchView } from '../cleaner/view'
import { RISK_ORDER } from '../shared/cleaner-view'
import type { Risk } from '../shared/cleaner-view'
import { jsonResponse } from './responses'
import type { AppServices } from './services'

function toRisk(value: FormDataEntryValue | null): Risk | null {
  return RISK_ORDER.find((risk) => risk === value) ?? null
}

/**
 * Registers the cleaner pages' form actions and two read-only JSON endpoints.
 * Actions never receive paths: they receive candidate ids from the last
 * detection, or batch ids from the vault.
 */
export function registerCleanerRoutes(app: App, services: AppServices): void {
  const { cleaner, scans } = services

  const finish = async (work: () => Promise<unknown>): Promise<Response> => {
    try {
      await work()
    } catch (error) {
      if (!(error instanceof CleanerError)) throw error
      cleaner.fail(error.message)
    }
    return redirect('/cleaner', 303)
  }

  app.get('/api/cleaner', () => jsonResponse({ data: buildCleanerView(cleaner, scans, null) }))
  app.get('/api/vault', () => jsonResponse({ data: cleaner.vault.list().map(toBatchView) }))

  app.post('/actions/cleaner/detect', async (context) => {
    const form = await context.request.formData()
    const scan = form.get('scan')
    return finish(() => cleaner.detect(typeof scan === 'string' ? scan : null))
  })

  app.post('/actions/cleaner/quarantine', async (context) => {
    const form = await context.request.formData()
    const ids = form.getAll('id').filter((value): value is string => typeof value === 'string')
    return finish(() => cleaner.quarantine(ids))
  })

  app.post('/actions/cleaner/quarantine-risk', async (context) => {
    const form = await context.request.formData()
    const risk = toRisk(form.get('risk'))
    return finish(() => (risk === null ? Promise.reject(new CleanerError('Choose a risk group.')) : cleaner.quarantineRisk(risk)))
  })

  app.post('/actions/vault/:id/restore', (context) => finish(() => cleaner.restore(context.params.id)))
  app.post('/actions/vault/:id/purge', (context) => finish(() => cleaner.purge(context.params.id)))
}
