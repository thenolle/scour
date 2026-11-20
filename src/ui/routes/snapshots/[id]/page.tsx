/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount, formatTimestamp } from '../../../../shared/format'
import { AppHeader } from '../../../components/chrome'
import { ReportNotice } from '../../../components/ReportNotice'
import type { loader } from './page.server'

export default function SnapshotPage(props: PageProps<ParamsOf<'/snapshots/[id]'>, LoaderData<typeof loader>>): Child {
	const { snapshot, compare, busy, report } = props.data
	const base = `/actions/snapshots/${encodeURIComponent(snapshot.id)}`
	const diff = compare === null ? null : compare.diff
	const removable = diff === null ? 0 : diff.removableFiles + diff.removableKeys
	return (
		<div class="app">
			<AppHeader />
			<main class="shell wide" data-job-id={snapshot.id} data-job-status={busy ? 'running' : 'none'}>
				<ReportNotice report={report} />

				<Card>
					<CardHeader>
						<CardTitle>{snapshot.name}</CardTitle>
						<CardDescription>{`Taken ${formatTimestamp(snapshot.createdAt)}. ${formatCount(snapshot.files)} entries and ${formatCount(snapshot.keys)} registry keys.`}</CardDescription>
					</CardHeader>
					<CardContent>
						<p>
							<span class={`badge badge-${snapshot.status}`}>{snapshot.status}</span>
							{snapshot.error === null ? '' : ` ${snapshot.error}`}
						</p>
						{busy ? <p class="muted">Working. This page reloads when it finishes.</p> : null}
						{busy ? null : (
							<form method="post" action={`${base}/delete`}>
								<Button type="submit">Delete snapshot</Button>
							</form>
						)}
					</CardContent>
				</Card>

				{snapshot.status === 'ready' ? (
					<Card>
						<CardHeader>
							<CardTitle>Compare with now</CardTitle>
							<CardDescription>Walks the same folders and registry roots again and lists everything that is new. Other programs that ran in the meantime also show up, so check the list.</CardDescription>
						</CardHeader>
						<CardContent>
							{compare !== null && compare.status === 'failed' ? <p class="muted">{compare.error ?? 'The comparison failed.'}</p> : null}
							{busy ? null : (
								<form method="post" action={`${base}/compare`}>
									<Button type="submit">{diff === null ? 'Compare' : 'Compare again'}</Button>
								</form>
							)}
						</CardContent>
					</Card>
				) : null}

				{diff === null ? null : (
					<Card>
						<CardHeader>
							<CardTitle>{`Added since the snapshot \u00b7 ${formatBytes(diff.totals.addedBytes)}`}</CardTitle>
							<CardDescription>{`Compared ${formatTimestamp(diff.comparedAt)}. Folders are quarantined and registry keys are exported before deletion, so both can be restored.`}</CardDescription>
						</CardHeader>
						<CardContent>
							<dl class="stats">
								<div><dt>New files</dt><dd class="num">{formatCount(diff.totals.addedFiles)}</dd></div>
								<div><dt>New keys</dt><dd class="num">{formatCount(diff.totals.addedKeys)}</dd></div>
								<div><dt>Changed files</dt><dd class="num">{formatCount(diff.totals.modifiedFiles)}</dd></div>
								<div><dt>Changed keys</dt><dd class="num">{formatCount(diff.totals.modifiedKeys)}</dd></div>
								<div><dt>Missing entries</dt><dd class="num">{formatCount(diff.totals.removedEntries)}</dd></div>
							</dl>
							{diff.files.length + diff.keys.length === 0 ? (
								<p class="muted">Nothing new was found.</p>
							) : (
								<form method="post" action={`${base}/remove`}>
									<input type="hidden" name="mode" value="selected" />
									<div class="table-wrap">
										<table class="table">
											<thead>
												<tr>
													<th class="check"></th>
													<th>Item</th>
													<th class="num-col">Size</th>
												</tr>
											</thead>
											<tbody>
												{diff.files.map((item) => (
													<tr key={item.id}>
														<td class="check">{item.removable ? <input type="checkbox" name="item" value={item.id} aria-label={`Select ${item.path}`} /> : null}</td>
														<td class="name-cell">
															<span class="entry" title={item.path}>{item.path}</span>
															<span class="note muted">{item.removable ? `${item.kind === 'dir' ? 'Folder' : 'File'} to quarantine \u00b7 ${formatCount(item.files)} files` : 'Not removed automatically: too close to a system location'}</span>
														</td>
														<td class="num">{formatBytes(item.bytes)}</td>
													</tr>
												))}
												{diff.keys.map((item) => (
													<tr key={item.id}>
														<td class="check">{item.removable ? <input type="checkbox" name="item" value={item.id} aria-label={`Select ${item.key}`} /> : null}</td>
														<td class="name-cell">
															<span class="entry" title={item.key}>{item.key}</span>
															<span class="note muted">{item.removable ? 'Registry key, exported before deletion' : 'Not removed automatically: protected location'}</span>
														</td>
														<td></td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
									{diff.hiddenFiles + diff.hiddenKeys > 0 ? <p class="muted">{`${formatCount(diff.hiddenFiles + diff.hiddenKeys)} more items are not shown. Remove everything covers them too.`}</p> : null}
									<Button type="submit">Remove selected</Button>
								</form>
							)}
							{removable === 0 ? null : (
								<form method="post" action={`${base}/remove`}>
									<input type="hidden" name="mode" value="all" />
									<Button type="submit">{`Remove all ${formatCount(removable)} removable items`}</Button>
								</form>
							)}
							{diff.modifiedSample.length === 0 ? null : (
								<details class="dup-group">
									<summary>{`Changed files (first ${formatCount(diff.modifiedSample.length)}). These are listed only; scour cannot undo a change.`}</summary>
									<ul class="paths">
										{diff.modifiedSample.map((path) => (
											<li key={path} class="path">{path}</li>
										))}
									</ul>
								</details>
							)}
						</CardContent>
					</Card>
				)}
			</main>
		</div>
	)
}
