/** @jsxImportSource @gambrel/view */
import type { Child } from '@gambrel/view'
import type { DuplicateStatus, ScanStatus } from '../../shared/scan-view'

export function AppHeader(): Child {
	return (
		<header class="topbar">
			<a class="brand" href="/">scour</a>
			<span class="tagline">Disk space analyzer</span>
		</header>
	)
}

export function StatusBadge(props: { readonly status: ScanStatus | DuplicateStatus }): Child {
	return <span class={`badge badge-${props.status}`}>{props.status}</span>
}

export function Meter(props: { readonly percent: number; readonly tone?: string }): Child {
	const width = Math.min(100, Math.max(0, props.percent))
	return (
		<div class="meter">
			<div class={props.tone === undefined ? 'meter-fill' : `meter-fill ${props.tone}`} style={`width:${width.toFixed(2)}%`}></div>
		</div>
	)
}
