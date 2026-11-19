export interface TreemapRect<T> {
	readonly item: T
	readonly x: number
	readonly y: number
	readonly width: number
	readonly height: number
}

function worst(areas: readonly number[], side: number): number {
	let sum = 0
	let max = 0
	let min = Infinity
	for (const area of areas) {
		sum += area
		max = Math.max(max, area)
		min = Math.min(min, area)
	}
	const squared = side * side
	return Math.max((squared * max) / (sum * sum), (sum * sum) / (squared * min))
}

/**
 * Lays items out as a squarified treemap inside a width by height box.
 * Items with no size are dropped. Rectangles are returned largest first.
 */
export function squarify<T extends { readonly value: number }>(input: readonly T[], width: number, height: number): TreemapRect<T>[] {
	const items = input.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
	const total = items.reduce((sum, item) => sum + item.value, 0)
	const rects: TreemapRect<T>[] = []
	if (total <= 0) return rects

	const scale = (width * height) / total
	let x = 0
	let y = 0
	let remainingWidth = width
	let remainingHeight = height
	let index = 0

	while (index < items.length) {
		const side = Math.min(remainingWidth, remainingHeight)
		const row: T[] = []
		let areas: number[] = []
		let score = Infinity
		while (index < items.length) {
			const next = items[index]
			if (next === undefined) break
			const candidate = [...areas, next.value * scale]
			const candidateScore = worst(candidate, side)
			if (row.length > 0 && candidateScore > score) break
			row.push(next)
			areas = candidate
			score = candidateScore
			index += 1
		}

		const rowArea = areas.reduce((sum, area) => sum + area, 0)
		if (remainingWidth >= remainingHeight) {
			const columnWidth = rowArea / remainingHeight
			let top = y
			row.forEach((item, offset) => {
				const cellHeight = (areas[offset] ?? 0) / columnWidth
				rects.push({ item, x, y: top, width: columnWidth, height: cellHeight })
				top += cellHeight
			})
			x += columnWidth
			remainingWidth -= columnWidth
		} else {
			const rowHeight = rowArea / remainingWidth
			let left = x
			row.forEach((item, offset) => {
				const cellWidth = (areas[offset] ?? 0) / rowHeight
				rects.push({ item, x: left, y, width: cellWidth, height: rowHeight })
				left += cellWidth
			})
			y += rowHeight
			remainingHeight -= rowHeight
		}
	}
	return rects
}
