/** @jsxImportSource @gambrel/view */
import type { Child } from '@gambrel/view'
import type { ActionReport } from '../../shared/cleaner-view'

export function ReportNotice(props: { readonly report: ActionReport | null }): Child {
  const { report } = props
  if (report === null) return null
  return (
    <div class={report.kind === 'ok' ? 'notice notice-ok' : 'notice notice-error'} role="status">
      <p>{report.message}</p>
      {report.failures.length === 0 ? null : (
        <ul class="failures">
          {report.failures.map((failure) => (
            <li key={failure}>{failure}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
