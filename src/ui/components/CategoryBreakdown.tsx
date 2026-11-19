/** @jsxImportSource @gambrel/view */
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount, formatPercent } from '../../shared/format'
import type { CategoryRow } from '../../shared/scan-view'
import { Meter } from './chrome'

export function CategoryBreakdown(props: { readonly rows: readonly CategoryRow[] }): Child {
  if (props.rows.length === 0) return <p class="muted">No files were found.</p>
  return (
    <ul class="categories">
      {props.rows.map((row) => (
        <li key={row.category} class="category-row">
          <div class="category-line">
            <span class={`swatch cat-${row.category}`}></span>
            <span class="category-name">{row.label}</span>
            <span class="num muted">{formatCount(row.count)} files</span>
            <span class="num">{formatBytes(row.size)}</span>
            <span class="num muted">{formatPercent(row.percent)}</span>
          </div>
          <Meter percent={row.percent} tone={`cat-${row.category}`} />
        </li>
      ))}
    </ul>
  )
}
