import { redirect } from '@gambrel/router'
import type { Loader, ParamsOf } from '@gambrel/router'
import { buildScanView, parseQuery } from '../../../../scanner/view'
import type { ScanView } from '../../../../shared/scan-view'
import type { PageContext } from '../../../context.server'

export const loader: Loader<ParamsOf<'/scan/[id]'>, ScanView, PageContext> = (context) => {
	const session = context.context.scans.get(context.params.id)
	if (session === undefined) return redirect('/', 303)
	return buildScanView(session, parseQuery(context.context.url.searchParams))
}
