/** @jsxImportSource @gambrel/view */
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader } from '@gambrel/components'
import { BrushCleaning, Camera, HardDrive, Package } from '@gambrel/icons'
import type { Child } from '@gambrel/view'
import type { DuplicateStatus, ScanStatus } from '../../shared/scan-view'
import { AboutDialog } from './AboutDialog'

export type NavSection = 'drives' | 'cleaner' | 'programs' | 'snapshots'

function NavLink(props: { readonly href: string; readonly label: string; readonly icon: Child; readonly active: boolean }): Child {
	const state = props.active ? { 'aria-current': 'page' as const } : {}
	return (
		<a class="gb-sidebar-link" href={props.href} {...state}>
			{props.icon}
			<span>{props.label}</span>
		</a>
	)
}

export function AppHeader(props: { readonly current?: NavSection }): Child {
	const { current } = props
	return (
		<Sidebar class="shell-sidebar">
			<SidebarHeader>
				<a class="brand" href="/">
					<HardDrive size={18} />
					<span>scour</span>
				</a>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Analyze</SidebarGroupLabel>
					<NavLink href="/" label="Drives" icon={<HardDrive size={16} />} active={current === 'drives'} />
					<NavLink href="/cleaner" label="Cleaner" icon={<BrushCleaning size={16} />} active={current === 'cleaner'} />
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Manage</SidebarGroupLabel>
					<NavLink href="/programs" label="Programs" icon={<Package size={16} />} active={current === 'programs'} />
					<NavLink href="/snapshots" label="Snapshots" icon={<Camera size={16} />} active={current === 'snapshots'} />
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<AboutDialog />
				<p class="foot muted">Local only. Nothing leaves this machine.</p>
			</SidebarFooter>
		</Sidebar>
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
