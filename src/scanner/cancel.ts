/** Thrown when a scan or duplicate search is stopped by the user. */
export class ScanCancelled extends Error {
	constructor() {
		super('Cancelled')
		this.name = 'ScanCancelled'
	}
}
