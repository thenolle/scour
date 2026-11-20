/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gambrel/components'
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount } from '../../shared/format'
import type { ScanView } from '../../shared/scan-view'

export function ProgressPanel(props: { readonly view: ScanView }): Child {
	const { progress, id } = props.view
	return (
		<Card>
			<CardHeader>
				<CardTitle>Scanning</CardTitle>
				<CardDescription>Folders are read one at a time. Counters update while the scan runs.</CardDescription>
			</CardHeader>
			<CardContent>
				<dl class="stats">
					<div>
						<dt>Files</dt>
						<dd class="num" data-live="files">{formatCount(progress.files)}</dd>
					</div>
					<div>
						<dt>Folders</dt>
						<dd class="num" data-live="directories">{formatCount(progress.directories)}</dd>
					</div>
					<div>
						<dt>Size</dt>
						<dd class="num" data-live="bytes">{formatBytes(progress.bytes)}</dd>
					</div>
					<div>
						<dt>Unreadable</dt>
						<dd class="num" data-live="errors">{formatCount(progress.errors)}</dd>
					</div>
				</dl>
				<p class="current-path muted" data-live="path">{progress.currentPath}</p>
				<form method="post" action={`/actions/scan/${encodeURIComponent(id)}/cancel`}>
					<Button type="submit" variant="outline">Cancel scan</Button>
				</form>
			</CardContent>
		</Card>
	)
}

export function MessagePanel(props: { readonly title: string; readonly message: string }): Child {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{props.title}</CardTitle>
				<CardDescription>{props.message}</CardDescription>
			</CardHeader>
			<CardContent>
				<a href="/">Back to drives</a>
			</CardContent>
		</Card>
	)
}
