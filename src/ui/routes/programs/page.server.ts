import type { Loader, ParamsOf } from '@gambrel/router'
import type { ProgramListView } from '../../../shared/program-view'
import { buildProgramListView } from '../../../uninstaller/view'
import type { PageContext } from '../../context.server'

export const loader: Loader<ParamsOf<'/programs'>, ProgramListView, PageContext> = (context) => buildProgramListView(context.context.uninstaller, context.context.url.searchParams, context.context.uninstaller.takeReport())
