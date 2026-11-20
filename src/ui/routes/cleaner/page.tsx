/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import { formatBytes, formatTimestamp } from '../../../shared/format'
import { CandidateGroup } from '../../components/CandidateGroup'
import { VaultPanel } from '../../components/VaultPanel'
import { AppHeader } from '../../components/chrome'
import type { loader } from './page.server'

export default function CleanerPage(props: PageProps<ParamsOf<'/cleaner'>, LoaderData<typeof loader>>): Child {
	const view = props.data
	const report = view.report
	return (
		<div class="app">
			<AppHeader current="cleaner" />
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
						<CardTitle>Cleaner</CardTitle>
						<CardDescription>{`Finds temporary files and caches. Nothing is deleted right away: items move to a quarantine and can be restored for ${view.retentionDays} days.`}</CardDescription>
					</CardHeader>
					<CardContent>
						<form class="detect-form" method="post" action="/actions/cleaner/detect">
							<Label for="scan">Also look for node_modules in</Label>
							<select id="scan" name="scan" class="select">
								<option value="">No scan</option>
								{view.scanOptions.map((option) => (
									<option key={option.id} value={option.id}>{option.root}</option>
								))}
							</select>
							<Button type="submit">Find junk</Button>
						</form>
						{view.detectedAt === null ? (
							<p class="muted">Select Find junk to look for removable files.</p>
						) : (
							<p class="muted">{`Last checked ${formatTimestamp(view.detectedAt)}. ${formatBytes(view.totalBytes)} can be moved to quarantine.`}</p>
						)}
					</CardContent>
				</Card>

				{view.groups.map((group) => (
					<CandidateGroup key={group.risk} group={group} />
				))}

				<Card>
					<CardHeader>
						<CardTitle>Quarantine</CardTitle>
						<CardDescription>Moved items stay here until you restore them, delete them, or their time runs out.</CardDescription>
					</CardHeader>
					<CardContent>
						<VaultPanel view={view} />
					</CardContent>
				</Card>
			</main>
		</div>
	)
}
