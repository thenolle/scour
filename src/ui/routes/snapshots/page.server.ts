import type { Loader, ParamsOf } from '@gambrel/router'
import type { SnapshotListView } from '../../../shared/snapshot-view'
import { buildSnapshotListView } from '../../../snapshots/view'
import type { PageContext } from '../../context.server'

export const loader: Loader<ParamsOf<'/snapshots'>, SnapshotListView, PageContext> = (context) => buildSnapshotListView(context.context.snapshots, context.context.snapshots.takeReport())
