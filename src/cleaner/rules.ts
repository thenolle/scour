import { readdir } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, parse } from 'node:path'
import type { Risk } from '../shared/cleaner-view'

export interface RuleEnvironment {
	readonly home: string
	readonly localAppData: string
	readonly temp: string
	readonly huggingFaceHome: string
	readonly ollamaModels: string
}

export function resolveEnvironment(env: Record<string, string | undefined> = process.env): RuleEnvironment {
	const home = env['USERPROFILE'] ?? env['HOME'] ?? homedir()
	return {
		home,
		localAppData: env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local'),
		temp: env['TEMP'] ?? env['TMP'] ?? tmpdir(),
		huggingFaceHome: env['HF_HOME'] ?? join(home, '.cache', 'huggingface'),
		ollamaModels: env['OLLAMA_MODELS'] ?? join(home, '.ollama', 'models')
	}
}

/**
 * A place where junk accumulates. `patterns` may use `*` as a whole path
 * segment. With `children` granularity every entry inside the matched folder
 * becomes its own item; with `whole` the matched folder is one item.
 */
export interface CleanRule {
	readonly id: string
	readonly group: string
	readonly title: string
	readonly risk: Risk
	readonly note: string
	readonly granularity: 'whole' | 'children'
	readonly patterns: (env: RuleEnvironment) => readonly string[]
}

const CHROMIUM_CACHES = ['Cache', 'Code Cache', 'GPUCache'] as const

const CHROMIUM_BROWSERS = [
	{ id: 'chrome', title: 'Google Chrome cache', base: ['Google', 'Chrome', 'User Data'] },
	{ id: 'edge', title: 'Microsoft Edge cache', base: ['Microsoft', 'Edge', 'User Data'] },
	{ id: 'brave', title: 'Brave cache', base: ['BraveSoftware', 'Brave-Browser', 'User Data'] }
] as const

const BROWSER_NOTE = 'Close the browser first. Files it is using cannot be moved.'

const browserRules: readonly CleanRule[] = [
	...CHROMIUM_BROWSERS.map(
		(browser): CleanRule => ({
			id: `${browser.id}-cache`,
			group: 'Browsers',
			title: browser.title,
			risk: 'redownloadable',
			note: BROWSER_NOTE,
			granularity: 'whole',
			patterns: (env) => CHROMIUM_CACHES.map((cache) => join(env.localAppData, ...browser.base, '*', cache))
		})
	),
	{
		id: 'firefox-cache',
		group: 'Browsers',
		title: 'Firefox cache',
		risk: 'redownloadable',
		note: BROWSER_NOTE,
		granularity: 'whole',
		patterns: (env) => [join(env.localAppData, 'Mozilla', 'Firefox', 'Profiles', '*', 'cache2')]
	}
]

export const RULES: readonly CleanRule[] = [
	{
		id: 'user-temp',
		group: 'Windows',
		title: 'Temporary files',
		risk: 'safe',
		note: 'Left behind by programs. Files that are in use are skipped.',
		granularity: 'children',
		patterns: (env) => [env.temp]
	},
	{
		id: 'inet-cache',
		group: 'Windows',
		title: 'Internet cache',
		risk: 'safe',
		note: 'Cached web content used by Windows components.',
		granularity: 'children',
		patterns: (env) => [join(env.localAppData, 'Microsoft', 'Windows', 'INetCache')]
	},
	{
		id: 'crash-dumps',
		group: 'Windows',
		title: 'Crash dumps',
		risk: 'safe',
		note: 'Memory dumps written when a program crashes.',
		granularity: 'children',
		patterns: (env) => [join(env.localAppData, 'CrashDumps')]
	},
	{
		id: 'error-reports',
		group: 'Windows',
		title: 'Error reports',
		risk: 'safe',
		note: 'Archived Windows Error Reporting data.',
		granularity: 'children',
		patterns: (env) => [join(env.localAppData, 'Microsoft', 'Windows', 'WER', 'ReportArchive'), join(env.localAppData, 'Microsoft', 'Windows', 'WER', 'ReportQueue')]
	},
	{
		id: 'shader-cache',
		group: 'Windows',
		title: 'DirectX shader cache',
		risk: 'safe',
		note: 'Rebuilt by games and apps the next time they run.',
		granularity: 'children',
		patterns: (env) => [join(env.localAppData, 'D3DSCache')]
	},
	...browserRules,
	{
		id: 'cargo-registry-cache',
		group: 'Developer',
		title: 'Cargo downloaded crates',
		risk: 'redownloadable',
		note: 'Crate archives. Cargo downloads them again on the next build.',
		granularity: 'whole',
		patterns: (env) => [join(env.home, '.cargo', 'registry', 'cache')]
	},
	{
		id: 'cargo-registry-src',
		group: 'Developer',
		title: 'Cargo extracted crates',
		risk: 'redownloadable',
		note: 'Unpacked crate sources. Cargo extracts them again when needed.',
		granularity: 'whole',
		patterns: (env) => [join(env.home, '.cargo', 'registry', 'src')]
	},
	{
		id: 'cargo-git',
		group: 'Developer',
		title: 'Cargo git dependencies',
		risk: 'redownloadable',
		note: 'Cloned git dependencies. Builds that need them fetch them again.',
		granularity: 'whole',
		patterns: (env) => [join(env.home, '.cargo', 'git')]
	},
	{
		id: 'nuget-packages',
		group: 'Developer',
		title: 'NuGet package cache',
		risk: 'redownloadable',
		note: 'Restored by the next build. Offline builds will fail until then.',
		granularity: 'whole',
		patterns: (env) => [join(env.home, '.nuget', 'packages')]
	},
	{
		id: 'gradle-caches',
		group: 'Developer',
		title: 'Gradle caches',
		risk: 'redownloadable',
		note: 'Dependencies and build caches. The next Gradle build downloads them again.',
		granularity: 'whole',
		patterns: (env) => [join(env.home, '.gradle', 'caches')]
	},
	{
		id: 'npm-cache',
		group: 'Developer',
		title: 'npm cache',
		risk: 'redownloadable',
		note: 'Downloaded package tarballs.',
		granularity: 'whole',
		patterns: (env) => [join(env.localAppData, 'npm-cache')]
	},
	{
		id: 'bun-cache',
		group: 'Developer',
		title: 'Bun install cache',
		risk: 'redownloadable',
		note: 'Downloaded packages. Installs fetch them again.',
		granularity: 'whole',
		patterns: (env) => [join(env.home, '.bun', 'install', 'cache')]
	},
	{
		id: 'pip-cache',
		group: 'Developer',
		title: 'pip cache',
		risk: 'redownloadable',
		note: 'Downloaded Python packages.',
		granularity: 'whole',
		patterns: (env) => [join(env.localAppData, 'pip', 'Cache')]
	},
	{
		id: 'huggingface-hub',
		group: 'AI models',
		title: 'Hugging Face',
		risk: 'review',
		note: 'One downloaded model or dataset. Anything you use offline has to be downloaded again.',
		granularity: 'children',
		patterns: (env) => [join(env.huggingFaceHome, 'hub')]
	},
	{
		id: 'ollama-models',
		group: 'AI models',
		title: 'Ollama models',
		risk: 'review',
		note: 'Every model you have pulled with Ollama. They can be pulled again, but they are large.',
		granularity: 'whole',
		patterns: (env) => [env.ollamaModels]
	}
]

/** Expands a path whose segments may be `*` into the folders that exist. */
export async function expandPattern(pattern: string): Promise<string[]> {
	const root = parse(pattern).root
	const segments = pattern
		.slice(root.length)
		.split(/[\\/]+/)
		.filter((segment) => segment !== '')
	let current: string[] = [root]
	for (const segment of segments) {
		const next: string[] = []
		for (const base of current) {
			if (segment !== '*') {
				next.push(join(base, segment))
				continue
			}
			try {
				for (const entry of await readdir(base, { withFileTypes: true })) {
					if (entry.isDirectory()) next.push(join(base, entry.name))
				}
			} catch {
				continue
			}
		}
		current = next
	}
	return current
}
