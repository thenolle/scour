import type { Category } from '../shared/scan-view'

const EXTENSIONS: readonly (readonly [Category, readonly string[]])[] = [
	['video', ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm', 'm4v', 'flv', 'mpg', 'mpeg', 'm2ts', 'vob']],
	['audio', ['mp3', 'flac', 'wav', 'aac', 'ogg', 'opus', 'm4a', 'wma', 'aiff']],
	['images', ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tif', 'tiff', 'heic', 'avif', 'svg', 'psd', 'raw', 'cr2', 'nef', 'arw']],
	['documents', ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'txt', 'rtf', 'md', 'epub', 'csv']],
	['archives', ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'iso', 'img', 'vhd', 'vhdx', 'vmdk', 'wim', 'cab']],
	['code', ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'py', 'rs', 'go', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'swift', 'lua', 'sh', 'ps1', 'bat', 'cmd', 'html', 'css', 'scss', 'sql', 'yml', 'yaml', 'toml', 'map', 'o', 'obj', 'pdb']],
	['applications', ['exe', 'msi', 'msix', 'appx', 'apk', 'jar', 'appimage']],
	['system', ['dll', 'sys', 'drv', 'cat', 'mui', 'dat', 'db', 'sqlite', 'log', 'etl', 'tmp', 'bak', 'pf', 'dmp', 'lnk']]
]

const LOOKUP = new Map<string, Category>()
for (const [category, extensions] of EXTENSIONS) {
	for (const extension of extensions) LOOKUP.set(extension, category)
}

/** Maps a file name to a category by its extension. */
export function categorize(fileName: string): Category {
	const dot = fileName.lastIndexOf('.')
	if (dot <= 0) return 'other'
	return LOOKUP.get(fileName.slice(dot + 1).toLowerCase()) ?? 'other'
}
