const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const
const COUNT_FORMAT = new Intl.NumberFormat('en-US')

/** Formats a byte count with binary units, for example `1.50 GiB`. */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
	let value = bytes
	let index = 0
	while (value >= 1024 && index < UNITS.length - 1) {
		value /= 1024
		index += 1
	}
	const digits = index === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2
	return `${value.toFixed(digits)} ${UNITS[index] ?? 'B'}`
}

export function formatCount(value: number): string {
	return COUNT_FORMAT.format(value)
}

export function formatPercent(value: number): string {
	if (value <= 0) return '0%'
	if (value < 0.1) return '<0.1%'
	return `${value.toFixed(value >= 10 ? 0 : 1)}%`
}

/** Formats a timestamp in UTC so server and browser render the same text. */
export function formatTimestamp(milliseconds: number): string {
	return `${new Date(milliseconds).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function formatDuration(milliseconds: number): string {
	const seconds = Math.max(0, Math.round(milliseconds / 1000))
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ${seconds % 60}s`
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
