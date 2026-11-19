import type { Loader, ParamsOf } from '@gambrel/router'
import { buildCleanerView } from '../../../cleaner/view'
import type { CleanerView } from '../../../shared/cleaner-view'
import type { PageContext } from '../../context.server'

export const loader: Loader<ParamsOf<'/cleaner'>, CleanerView, PageContext> = (context) => buildCleanerView(context.context.cleaner, context.context.scans, context.context.cleaner.takeReport())
