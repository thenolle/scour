/** @jsxImportSource @gambrel/view */
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount, formatPercent } from '../../shared/format'
import { scanHref } from '../../shared/links'
import { CATEGORY_LABELS } from '../../shared/scan-view'
import type { ScanView, SortKey, SortOrder } from '../../shared/scan-view'
import { Meter } from './chrome'

function sortLink(view: ScanView, key: SortKey, label: string): Child {
	const active = view.query.sort === key
	const order: SortOrder = active ? (view.query.order === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc'
	const arrow = active ? (view.query.order === 'asc' ? ' \u2191' : ' \u2193') : ''
	return (
		<a class={active ? 'sort active' : 'sort'} href={scanHref(view.id, { dir: view.directoryPath, sort: key, order })}>
			{`${label}${arrow}`}
		</a>
	)
}

export function DirectoryTable(props: { readonly view: ScanView }): Child {
	const { view } = props
	return (
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th>{sortLink(view, 'name', 'Name')}</th>
						<th class="num-col">{sortLink(view, 'size', 'Size')}</th>
						<th class="share-col">Share</th>
						<th class="num-col">{sortLink(view, 'items', 'Files')}</th>
					</tr>
				</thead>
				<tbody>
					{view.rows.map((row) => (
						<tr key={row.path}>
							<td class="name-cell">
								{row.href === null ? (
									<span class="entry" title={row.path}>{row.name}</span>
								) : (
									<a class="entry entry-dir" href={row.href} title={row.path}>{row.name}</a>
								)}
								{row.category === null ? null : <span class="tag muted">{CATEGORY_LABELS[row.category]}</span>}
							</td>
							<td class="num">{formatBytes(row.size)}</td>
							<td class="share">
								<span class="num">{formatPercent(row.percent)}</span>
								<Meter percent={row.percent} />
							</td>
							<td class="num">{formatCount(row.items)}</td>
						</tr>
					))}
					{view.hidden.files > 0 ? (
						<tr class="muted">
							<td>{`${formatCount(view.hidden.files)} smaller files`}</td>
							<td class="num">{formatBytes(view.hidden.size)}</td>
							<td></td>
							<td class="num">{formatCount(view.hidden.files)}</td>
						</tr>
					) : null}
				</tbody>
			</table>
			{view.truncated > 0 ? <p class="muted">{`${formatCount(view.truncated)} more entries are not shown.`}</p> : null}
		</div>
	)
}
