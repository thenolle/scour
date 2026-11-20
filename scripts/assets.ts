import { cp } from 'node:fs/promises'
import { join } from 'node:path'

const STYLESHEETS = ['app.css', 'cleaner.css', 'programs.css', 'snapshots.css'] as const

/**
 * Copies the component stylesheet, the application stylesheets and the static
 * files (favicon) next to the browser bundle so one directory serves every
 * public asset.
 */
export async function copyStyles(root: string): Promise<void> {
	const base = await Bun.file(join(root, 'node_modules', '@gambrel', 'components', 'dist', 'styles.css')).text()
	const own = await Promise.all(STYLESHEETS.map((name) => Bun.file(join(root, 'src', 'ui', 'styles', name)).text()))
	await Bun.write(join(root, 'dist', 'client', 'app.css'), [base, ...own].join('\n'))
	await cp(join(root, 'src', 'ui', 'assets'), join(root, 'dist', 'client'), { recursive: true })
}
