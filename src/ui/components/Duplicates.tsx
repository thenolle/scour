/** @jsxImportSource @gambrel/view */
import { Button } from '@gambrel/components'
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount } from '../../shared/format'
import type { ScanView } from '../../shared/scan-view'

export function Duplicates(props: { readonly view: ScanView }): Child {
	const { duplicates, id } = props.view
	const base = `/actions/scan/${encodeURIComponent(id)}`

	if (duplicates.status === 'running') {
		return (
			<div>
				<p class="num" data-live="dup-progress">{`${formatCount(duplicates.done)} of ${formatCount(duplicates.total)} files checked`}</p>
				<form method="post" action={`${base}/cancel`}>
					<Button type="submit">Stop</Button>
				</form>
			</div>
		)
	}

	const start = (label: string): Child => (
		<form method="post" action={`${base}/duplicates`}>
			<Button type="submit">{label}</Button>
		</form>
	)

	if (duplicates.status === 'idle') {
		return (
			<div>
				<p class="muted">Compares files of 1 MiB or larger. Files with the same size are hashed with BLAKE2b-256, first the opening 64 KiB and then the whole file. Nothing is changed or deleted.</p>
				{start('Find duplicates')}
			</div>
		)
	}

	if (duplicates.status === 'failed' || duplicates.status === 'cancelled') {
		return (
			<div>
				<p class="muted">{duplicates.status === 'cancelled' ? 'The search was stopped.' : (duplicates.error ?? 'The search failed.')}</p>
				{start('Try again')}
			</div>
		)
	}

	if (duplicates.groupCount === 0) return <p class="muted">No duplicate files of 1 MiB or larger were found.</p>

	return (
		<div>
			<p>
				{`${formatCount(duplicates.groupCount)} groups of identical files. Keeping one copy of each would free `}
				<span class="num">{formatBytes(duplicates.reclaimable)}</span>
				.
			</p>
			{duplicates.groups.map((group, index) => (
				<details key={index} class="dup-group">
					<summary>
						<span class="num">{formatBytes(group.size)}</span>
						{` \u00d7 ${group.copies} copies, `}
						<span class="num">{formatBytes(group.wasted)}</span>
						{' reclaimable'}
					</summary>
					<ul class="paths">
						{group.paths.map((path) => (
							<li key={path} class="path">{path}</li>
						))}
					</ul>
				</details>
			))}
			{duplicates.groupCount > duplicates.groups.length ? (
				<p class="muted">{`Showing the ${formatCount(duplicates.groups.length)} largest groups.`}</p>
			) : null}
		</div>
	)
}
