import type { Loader, ParamsOf } from '@gambrel/router'
import type { HealthInfo } from '../../shared/meta'
import type { PageContext } from '../context.server'

export const loader: Loader<ParamsOf<'/'>, HealthInfo, PageContext> = (context) => context.context.info
