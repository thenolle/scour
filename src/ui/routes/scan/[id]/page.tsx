/** @jsxImportSource @gambrel/view */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount, formatDuration } from '../../../../shared/format'
import { CategoryBreakdown } from '../../../components/CategoryBreakdown'
import { DirectoryTable } from '../../../components/DirectoryTable'
import { Duplicates } from '../../../components/Duplicates'
import { Treemap } from '../../../components/Treemap'
import { AppHeader, StatusBadge } from '../../../components/chrome'
import { MessagePanel, ProgressPanel } from '../../../components/panels'
import type { loader } from './page.server'

export default function ScanPage(props: PageProps<ParamsOf<'/scan/[id]'>, LoaderData<typeof loader>>): Child {
	const view = props.data
	const duration = view.finishedAt === null ? '' : formatDuration(view.finishedAt - view.startedAt)
	const last = view.crumbs.length - 1
	return (
		<div class="app">
			<AppHeader current="drives" />
			<main class="shell wide" data-scan-id={view.id} data-scan-status={view.status} data-dup-status={view.duplicates.status}>
				<div class="page-head">
					<div class="page-title">
						<h1 class="title-path" title={view.root}>{view.root}</h1>
						<StatusBadge status={view.status} />
					</div>
					{view.ready ? (
						<dl class="stats">
							<div>
								<dt>Size</dt>
								<dd class="num">{formatBytes(view.totalSize)}</dd>
							</div>
							<div>
								<dt>Files</dt>
								<dd class="num">{formatCount(view.progress.files)}</dd>
							</div>
							<div>
								<dt>Folders</dt>
								<dd class="num">{formatCount(view.progress.directories)}</dd>
							</div>
							<div>
								<dt>Unreadable</dt>
								<dd class="num">{formatCount(view.progress.errors)}</dd>
							</div>
							<div>
								<dt>Duration</dt>
								<dd class="num">{duration}</dd>
							</div>
						</dl>
					) : null}
				</div>

				{view.status === 'running' ? <ProgressPanel view={view} /> : null}
				{view.status === 'failed' ? <MessagePanel title="The scan failed" message={view.error ?? 'The scan stopped with an unknown error.'} /> : null}
				{view.status === 'cancelled' ? <MessagePanel title="Scan cancelled" message="The scan was stopped before it finished, so there are no results to show." /> : null}

				{view.ready ? (
					<div class="results">
						<Card>
							<CardHeader>
								<CardTitle>Space by item</CardTitle>
								<CardDescription>The largest items in the selected folder. Select a folder to open it.</CardDescription>
							</CardHeader>
							<CardContent>
								<nav class="crumbs" aria-label="Folder path">
									{view.crumbs.map((crumb, index) => (
										<span key={crumb.href} class="crumb">
											{index > 0 ? <span class="sep">/</span> : null}
											{index === last ? <span class="current">{crumb.name}</span> : <a href={crumb.href}>{crumb.name}</a>}
										</span>
									))}
								</nav>
								<Treemap cells={view.treemap} />
							</CardContent>
						</Card>

						<div class="columns">
							<Card>
								<CardHeader>
									<CardTitle>Folder contents</CardTitle>
									<CardDescription>{`${formatBytes(view.directorySize)} in this folder. Files are listed up to the 100 largest per folder.`}</CardDescription>
								</CardHeader>
								<CardContent>
									<DirectoryTable view={view} />
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>File types</CardTitle>
									<CardDescription>Across the whole scan, by extension.</CardDescription>
								</CardHeader>
								<CardContent>
									<CategoryBreakdown rows={view.categories} />
								</CardContent>
							</Card>
						</div>

						<Card>
							<CardHeader>
								<CardTitle>Duplicate files</CardTitle>
								<CardDescription>Identical files in the scanned folder.</CardDescription>
							</CardHeader>
							<CardContent>
								<Duplicates view={view} />
							</CardContent>
						</Card>
					</div>
				) : null}
			</main>
		</div>
	)
}
