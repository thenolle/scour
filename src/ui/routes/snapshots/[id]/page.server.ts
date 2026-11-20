import { redirect } from '@gambrel/router'
import type { Loader, ParamsOf } from '@gambrel/router'
import type { SnapshotDetailView } from '../../../../shared/snapshot-view'
import { buildSnapshotDetailView } from '../../../../snapshots/view'
import type { PageContext } from '../../../context.server'

export const loader: Loader<ParamsOf<'/snapshots/[id]'>, SnapshotDetailView, PageContext> = (context) => {
	const manager = context.context.snapshots
	const view = buildSnapshotDetailView(manager, context.params.id, manager.takeReport())
	return view === null ? redirect('/snapshots', 303) : view
}
