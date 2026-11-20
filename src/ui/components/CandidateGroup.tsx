/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gambrel/components'
import type { Child } from '@gambrel/view'
import type { RiskGroupView } from '../../shared/cleaner-view'
import { formatBytes, formatCount } from '../../shared/format'

export function CandidateGroup(props: { readonly group: RiskGroupView }): Child {
	const { group } = props
	if (group.candidates.length === 0) return null
	return (
		<Card>
			<CardHeader>
				<div class="group-head">
					<div>
						<CardTitle>{`${group.label} \u00b7 ${formatBytes(group.bytes)}`}</CardTitle>
						<CardDescription>{group.summary}</CardDescription>
					</div>
					{group.risk === 'review' ? null : (
						<form method="post" action="/actions/cleaner/quarantine-risk">
							<input type="hidden" name="risk" value={group.risk} />
							<Button type="submit">{`Quarantine all ${group.label.toLowerCase()}`}</Button>
						</form>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<form method="post" action="/actions/cleaner/quarantine">
					<div class="table-wrap">
						<table class="table">
							<thead>
								<tr>
									<th class="check"></th>
									<th>Item</th>
									<th class="num-col">Size</th>
									<th class="num-col">Files</th>
								</tr>
							</thead>
							<tbody>
								{group.candidates.map((candidate) => (
									<tr key={candidate.id}>
										<td class="check">
											<input type="checkbox" class="gb-checkbox" name="id" value={candidate.id} aria-label={`Select ${candidate.title}`} />
										</td>
										<td class="name-cell">
											<span class="entry" title={candidate.path}>{candidate.title}</span>
											<span class="path-line muted" title={candidate.path}>{candidate.path}</span>
											<span class="note muted">{candidate.note}</span>
										</td>
										<td class="num">{formatBytes(candidate.bytes)}</td>
										<td class="num">{formatCount(candidate.files)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<Button type="submit">Quarantine selected</Button>
				</form>
			</CardContent>
		</Card>
	)
}
