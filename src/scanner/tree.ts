export interface FileEntry {
	readonly name: string
	readonly size: number
	readonly modified: number
}

/**
 * A directory in a scan. `size` and `fileCount` include everything below it.
 * `files` holds only the largest files directly inside; `ownFiles` and
 * `ownSize` count all of them.
 */
export class DirNode {
	readonly children: DirNode[] = []
	files: FileEntry[] = []
	ownSize = 0
	ownFiles = 0
	size = 0
	fileCount = 0

	constructor(
		readonly path: string,
		readonly name: string,
		readonly parent: DirNode | null
	) { }
}
