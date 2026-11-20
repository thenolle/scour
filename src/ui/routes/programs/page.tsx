/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount, formatTimestamp } from '../../../shared/format'
import type { ProgramSort } from '../../../shared/program-view'
import { AppHeader } from '../../components/chrome'
import type { loader } from './page.server'

function sortHref(query: string, sort: ProgramSort): string {
	const params = new URLSearchParams()
	if (query !== '') params.set('q', query)
	params.set('sort', sort)
	return `/programs?${params.toString()}`
}

export default function ProgramsPage(props: PageProps<ParamsOf<'/programs'>, LoaderData<typeof loader>>): Child {
	const view = props.data
	const report = view.report
	return (
		<div class="app">
			<AppHeader current="programs" />
			<main class="shell wide">
				{report === null ? null : (
					<div class={report.kind === 'ok' ? 'notice notice-ok' : 'notice notice-error'} role="status">
						<p>{report.message}</p>
						{report.failures.length === 0 ? null : (
							<ul class="failures">
								{report.failures.map((failure) => (
									<li key={failure}>{failure}</li>
								))}
							</ul>
						)}
					</div>
				)}

				<Card>
					<CardHeader>
						<CardTitle>Installed programs</CardTitle>
						<CardDescription>{view.loadedAt === null ? 'The list has not been loaded.' : `${formatCount(view.programs.length)} of ${formatCount(view.total)} programs. Loaded ${formatTimestamp(view.loadedAt)}.`}</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="toolbar">
							<form class="toolbar-search" method="get" action="/programs">
								<Label for="q">Search</Label>
								<Input id="q" name="q" value={view.query} placeholder="Name or publisher" />
								<input type="hidden" name="sort" value={view.sort} />
								<Button type="submit" variant="secondary">Search</Button>
							</form>
							<form method="post" action="/actions/programs/refresh">
								<Button type="submit" variant="outline">Reload list</Button>
							</form>
						</div>
						<div class="table-wrap">
							<table class="table">
								<thead>
									<tr>
										<th><a class={view.sort === 'name' ? 'sort active' : 'sort'} href={sortHref(view.query, 'name')}>Name</a></th>
										<th>Publisher</th>
										<th>Version</th>
										<th class="num-col"><a class={view.sort === 'size' ? 'sort active' : 'sort'} href={sortHref(view.query, 'size')}>Size</a></th>
										<th><a class={view.sort === 'date' ? 'sort active' : 'sort'} href={sortHref(view.query, 'date')}>Installed</a></th>
										<th>Scope</th>
									</tr>
								</thead>
								<tbody>
									{view.programs.map((program) => (
										<tr key={program.id}>
											<td class="name-cell"><a class="entry entry-dir" href={`/programs/${encodeURIComponent(program.id)}`} title={program.name}>{program.name}</a></td>
											<td class="muted">{program.publisher}</td>
											<td class="num muted">{program.version}</td>
											<td class="num">{program.sizeBytes === null ? '' : formatBytes(program.sizeBytes)}</td>
											<td class="num muted">{program.installDate}</td>
											<td class="muted">{program.source}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Registry backups</CardTitle>
						<CardDescription>Every registry key is exported to a .reg file before it is deleted. Restoring imports the file again.</CardDescription>
					</CardHeader>
					<CardContent>
						{view.backups.length === 0 ? (
							<p class="muted">No registry keys have been removed.</p>
						) : (
							<div class="vault">
								{view.backups.map((backup) => (
									<section key={backup.id} class="batch">
										<div class="batch-head">
											<div>
												<strong>{backup.programName}</strong>
												<span class="muted">{` \u00b7 ${formatCount(backup.keys.length)} keys \u00b7 ${formatTimestamp(backup.createdAt)}`}</span>
											</div>
											<div class="batch-actions">
												<form method="post" action={`/actions/registry/${encodeURIComponent(backup.id)}/restore`}>
													<Button type="submit" variant="outline">Restore</Button>
												</form>
												<form method="post" action={`/actions/registry/${encodeURIComponent(backup.id)}/discard`}>
													<Button type="submit" variant="destructive">Delete backup</Button>
												</form>
											</div>
										</div>
										<ul class="paths">
											{backup.keys.map((key) => (
												<li key={key} class="path">{key}</li>
											))}
										</ul>
									</section>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</main>
		</div>
	)
}
