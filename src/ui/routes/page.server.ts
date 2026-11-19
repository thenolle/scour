import type { Loader, ParamsOf } from '@gambrel/router'
import { summarize } from '../../scanner/view'
import type { HomeData } from '../../shared/scan-view'
import type { PageContext } from '../context.server'

export const loader: Loader<ParamsOf<'/'>, HomeData, PageContext> = (context) => ({
  drives: context.context.drives.snapshot(),
  scans: context.context.scans.list().map(summarize),
  error: context.context.url.searchParams.get('error')
})
