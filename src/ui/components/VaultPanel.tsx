/** @jsxImportSource @gambrel/view */
import { Button } from '@gambrel/components'
import type { Child } from '@gambrel/view'
import type { CleanerView } from '../../shared/cleaner-view'
import { formatBytes, formatCount, formatTimestamp } from '../../shared/format'

export function VaultPanel(props: { readonly view: CleanerView }): Child {
	const { batches, retentionDays } = props.view
	if (batches.length === 0) return <p class="muted">{`Nothing is in quarantine. Items you move here are kept for ${retentionDays} days.`}</p>
	return (
		<div class="vault">
			{batches.map((batch) => (
				<section key={batch.id} class="batch">
					<div class="batch-head">
						<div>
							<strong class="num">{formatBytes(batch.bytes)}</strong>
							<span class="muted">{` in ${formatCount(batch.items.length)} items. Moved ${formatTimestamp(batch.createdAt)}, deleted for good ${formatTimestamp(batch.expiresAt)}.`}</span>
						</div>
						<div class="batch-actions">
							<form method="post" action={`/actions/vault/${encodeURIComponent(batch.id)}/restore`}>
								<Button type="submit">Restore</Button>
							</form>
							<form method="post" action={`/actions/vault/${encodeURIComponent(batch.id)}/purge`}>
								<Button type="submit">Delete now</Button>
							</form>
						</div>
					</div>
					<ul class="paths">
						{batch.items.map((item) => (
							<li key={item.name} class="path">{item.originalPath}</li>
						))}
					</ul>
				</section>
			))}
		</div>
	)
}
