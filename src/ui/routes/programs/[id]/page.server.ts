import { redirect } from '@gambrel/router'
import type { Loader, ParamsOf } from '@gambrel/router'
import type { ProgramDetailView } from '../../../../shared/program-view'
import { buildProgramDetailView } from '../../../../uninstaller/view'
import type { PageContext } from '../../../context.server'

export const loader: Loader<ParamsOf<'/programs/[id]'>, ProgramDetailView, PageContext> = (context) => {
	const manager = context.context.uninstaller
	const view = buildProgramDetailView(manager, context.params.id, manager.takeReport())
	return view === null ? redirect('/programs', 303) : view
}
