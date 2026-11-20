/** @jsxImportSource @gambrel/view */
import { Button, DescriptionList, Dialog } from '@gambrel/components'
import { Info } from '@gambrel/icons'
import type { Child } from '@gambrel/view'
import { APP_VERSION } from '../../shared/version'

function ExternalLink(props: { readonly href: string; readonly children: Child }): Child {
	return (
		<a class="about-link" href={props.href} target="_blank" rel="noopener noreferrer">
			{props.children}
		</a>
	)
}

export function AboutDialog(): Child {
	return (
		<Dialog
			id="about"
			trigger={
				<Button variant="ghost" size="sm" class="about-button">
					<Info size={16} />
					About
				</Button>
			}
			title="scour"
			description="Disk space analyzer, junk cleaner and uninstaller for Windows."
			footer={(close: () => void) => (
				<Button variant="outline" onClick={close}>
					Close
				</Button>
			)}
		>
			<DescriptionList
				items={[
					{ term: 'Version', description: <span class="num">{APP_VERSION}</span> },
					{ term: 'Author', description: <ExternalLink href="https://github.com/thenolle">Nolly (thenolle)</ExternalLink> },
					{ term: 'Source', description: <ExternalLink href="https://github.com/thenolle/scour">github.com/thenolle/scour</ExternalLink> },
					{ term: 'License', description: <ExternalLink href="https://github.com/thenolle/scour/blob/master/LICENSE">PolyForm Strict 1.0.0</ExternalLink> },
					{ term: 'Security', description: <ExternalLink href="https://github.com/thenolle/scour/blob/master/SECURITY.md">Report a vulnerability</ExternalLink> },
					{ term: 'Privacy', description: 'Runs on this machine and listens on localhost only. Nothing is sent anywhere.' }
				]}
			/>
			<p class="about-note muted">
				Built with <ExternalLink href="https://bun.com">Bun</ExternalLink>, <ExternalLink href="https://www.typescriptlang.org">TypeScript</ExternalLink> and{' '}
				<ExternalLink href="https://github.com/thenolle/gambrel">Gambrel</ExternalLink>, whose components and icons make up the whole interface. The design follows{' '}
				<ExternalLink href="https://ui.shadcn.com">shadcn/ui</ExternalLink>.
			</p>
		</Dialog>
	)
}
