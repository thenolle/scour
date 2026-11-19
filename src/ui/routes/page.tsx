/** @jsxImportSource @gambrel/view */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import type { loader } from './page.server'

export default function StatusPage(props: PageProps<ParamsOf<'/'>, LoaderData<typeof loader>>): Child {
	const { data } = props
	return (
		<main class="shell">
			<Card>
				<CardHeader>
					<CardTitle>scour</CardTitle>
					<CardDescription>Disk analyzer, cleaner and uninstaller for Windows.</CardDescription>
				</CardHeader>
				<CardContent>
					<dl class="facts">
						<dt>Status</dt>
						<dd class="num">{data.status}</dd>
						<dt>Version</dt>
						<dd class="num">{data.version}</dd>
						<dt>Platform</dt>
						<dd class="num">{data.platform}</dd>
						<dt>Bun</dt>
						<dd class="num">{data.bun}</dd>
					</dl>
				</CardContent>
			</Card>
		</main>
	)
}
