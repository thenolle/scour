/** @jsxImportSource @gambrel/view */
import type { Child } from '@gambrel/view'
import { formatBytes, formatPercent } from '../../shared/format'
import type { TreemapCell } from '../../shared/scan-view'

export function Treemap(props: { readonly cells: readonly TreemapCell[] }): Child {
	if (props.cells.length === 0) return <p class="muted">There is nothing to draw in this folder.</p>
	return (
		<div class="treemap">
			{props.cells.map((cell) => {
				const style = `left:${cell.x.toFixed(3)}%;top:${cell.y.toFixed(3)}%;width:${cell.width.toFixed(3)}%;height:${cell.height.toFixed(3)}%`
				const tone = cell.kind === 'dir' ? 'cat-folder' : `cat-${cell.category ?? 'other'}`
				const title = `${cell.label}: ${formatBytes(cell.size)}, ${formatPercent(cell.percent)}`
				const label =
					cell.width > 7 && cell.height > 12 ? (
						<span class="cell-label">
							<span class="cell-name">{cell.label}</span>
							<span class="num">{formatBytes(cell.size)}</span>
						</span>
					) : null
				return cell.href === null ? (
					<div key={cell.label} class={`cell ${tone}`} style={style} title={title}>{label}</div>
				) : (
					<a key={cell.label} class={`cell ${tone}`} style={style} title={title} href={cell.href}>{label}</a>
				)
			})}
		</div>
	)
}
