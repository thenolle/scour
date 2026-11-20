/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount } from '../../../../shared/format'
import { AppHeader } from '../../../components/chrome'
import type { loader } from './page.server'

export default function ProgramPage(props: PageProps<ParamsOf<'/programs/[id]'>, LoaderData<typeof loader>>): Child {
  const view = props.data
  const { program, job, leftovers, report } = view
  const base = `/actions/programs/${encodeURIComponent(program.id)}`
  const running = job !== null && job.status === 'running'
  const found = leftovers === null ? 0 : leftovers.files.length + leftovers.keys.length
  return (
    <div class="app">
      <AppHeader current="programs" />
      <main class="shell wide" data-job-id={program.id} data-job-status={job === null ? 'none' : job.status}>
        {report === null ? null : (
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
        )}

        <Card>
          <CardHeader>
            <CardTitle>{program.name}</CardTitle>
            <CardDescription>{[program.publisher, program.version, view.stillInstalled ? null : 'No longer registered'].filter((part) => part !== null && part !== '').join(' \u00b7 ')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl class="facts">
              <dt>Install location</dt>
              <dd class="path">{program.installLocation === '' ? 'Not recorded' : program.installLocation}</dd>
              <dt>Registry entry</dt>
              <dd class="path">{view.keyPath}</dd>
              <dt>Size</dt>
              <dd class="num">{program.sizeBytes === null ? 'Not recorded' : formatBytes(program.sizeBytes)}</dd>
              <dt>Silent command</dt>
              <dd class="path">{view.silentCommand ?? 'None. This program only offers an interactive uninstaller.'}</dd>
              <dt>Interactive command</dt>
              <dd class="path">{view.interactiveCommand ?? 'None'}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uninstall</CardTitle>
            <CardDescription>Runs the program's own uninstaller and waits for it. Interactive uninstallers open their own window.</CardDescription>
          </CardHeader>
          <CardContent>
            {job === null ? null : (
              <p>
                <span class={`badge badge-${job.status}`}>{job.status}</span>
                {job.message === null ? '' : ` ${job.message}`}
              </p>
            )}
            {view.stillInstalled && !running ? (
              <div class="batch-actions">
                {view.silentCommand === null ? null : (
                  <form method="post" action={`${base}/uninstall`}>
                    <input type="hidden" name="mode" value="silent" />
                    <Button type="submit">Uninstall silently</Button>
                  </form>
                )}
                <form method="post" action={`${base}/uninstall`}>
                  <input type="hidden" name="mode" value="interactive" />
                  <Button type="submit">Uninstall with the program's window</Button>
                </form>
              </div>
            ) : null}
            {running ? <p class="muted">Waiting for the uninstaller to finish. This page reloads when it does.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leftovers</CardTitle>
            <CardDescription>Looks for folders and registry keys named after the program. Nothing is selected for you. Removing machine-wide keys or folders under Program Files needs an elevated terminal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" action={`${base}/leftovers`}>
              <Button type="submit">Scan for leftovers</Button>
            </form>
            {leftovers === null ? null : found === 0 ? (
              <p class="muted">Nothing was found.</p>
            ) : (
              <form method="post" action={`${base}/remove-leftovers`}>
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th class="check"></th>
                        <th>Item</th>
                        <th>Match</th>
                        <th class="num-col">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leftovers.files.map((file) => (
                        <tr key={file.id}>
                          <td class="check"><input type="checkbox" class="gb-checkbox" name="leftover" value={file.id} aria-label={`Select ${file.path}`} /></td>
                          <td class="name-cell"><span class="entry" title={file.path}>{file.path}</span><span class="note muted">{`Folder to quarantine \u00b7 ${formatCount(file.files)} files \u00b7 ${file.reason}`}</span></td>
                          <td><span class={`badge badge-${file.confidence}`}>{file.confidence}</span></td>
                          <td class="num">{formatBytes(file.bytes)}</td>
                        </tr>
                      ))}
                      {leftovers.keys.map((key) => (
                        <tr key={key.id}>
                          <td class="check"><input type="checkbox" class="gb-checkbox" name="leftover" value={key.id} aria-label={`Select ${key.key}`} /></td>
                          <td class="name-cell"><span class="entry" title={key.key}>{key.key}</span><span class="note muted">{`Registry key, exported before deletion \u00b7 ${key.reason}`}</span></td>
                          <td><span class={`badge badge-${key.confidence}`}>{key.confidence}</span></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="submit">Remove selected</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
