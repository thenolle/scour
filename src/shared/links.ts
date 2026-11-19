import type { SortKey, SortOrder } from './scan-view'

export interface ScanQuery {
	readonly dir?: string
	readonly sort?: SortKey
	readonly order?: SortOrder
}

/** Builds the URL of a scan page, optionally pointing at a folder and sort order. */
export function scanHref(id: string, query: ScanQuery = {}): string {
	const params = new URLSearchParams()
	if (query.dir !== undefined) params.set('dir', query.dir)
	if (query.sort !== undefined) params.set('sort', query.sort)
	if (query.order !== undefined) params.set('order', query.order)
	const text = params.toString()
	const base = `/scan/${encodeURIComponent(id)}`
	return text === '' ? base : `${base}?${text}`
}
