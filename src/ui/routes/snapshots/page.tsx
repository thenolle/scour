/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import { formatCount, formatTimestamp } from '../../../shared/format'
import { AppHeader } from '../../components/chrome'
import { ReportNotice } from '../../components/ReportNotice'
import type { loader } from './page.server'

export default function SnapshotsPage(props: PageProps<ParamsOf<'/snapshots'>, LoaderData<typeof loader>>): Child {
	const view = props.data
	return (
		<div class="app">
			<AppHeader current="snapshots" />
			<main class="shell wide">
				<ReportNotice report={view.report} />

				<Card>
					<CardHeader>
						<CardTitle>Take a snapshot</CardTitle>
						<CardDescription>Record the files in Program Files, ProgramData, AppData and the desktops, and the registry under Software. Take one before you run an installer, then compare afterwards to see exactly what it added. Taking a snapshot can take a few minutes.</CardDescription>
					</CardHeader>
					<CardContent>
						<form class="path-form" method="post" action="/actions/snapshots/create">
							<Label for="name">Name</Label>
							<Input id="name" name="name" placeholder="Before installing Example" maxlength="80" required />
							<Button type="submit">Take snapshot</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Snapshots</CardTitle>
						<CardDescription>Snapshots are stored on disk and survive restarts.</CardDescription>
					</CardHeader>
					<CardContent>
						{view.snapshots.length === 0 ? (
							<p class="muted">No snapshots yet.</p>
						) : (
							<div class="table-wrap">
								<table class="table">
									<thead>
										<tr>
											<th>Name</th>
											<th>Status</th>
											<th class="num-col">Entries</th>
											<th class="num-col">Registry keys</th>
											<th>Taken</th>
										</tr>
									</thead>
									<tbody>
										{view.snapshots.map((snapshot) => (
											<tr key={snapshot.id}>
												<td class="name-cell"><a class="entry entry-dir" href={`/snapshots/${encodeURIComponent(snapshot.id)}`}>{snapshot.name}</a></td>
												<td><span class={`badge badge-${snapshot.status}`}>{snapshot.status}</span></td>
												<td class="num">{formatCount(snapshot.files)}</td>
												<td class="num">{formatCount(snapshot.keys)}</td>
												<td class="num muted">{formatTimestamp(snapshot.createdAt)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</CardContent>
				</Card>
			</main>
		</div>
	)
}
