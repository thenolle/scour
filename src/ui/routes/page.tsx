/** @jsxImportSource @gambrel/view */
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@gambrel/components'
import type { LoaderData, PageProps, ParamsOf } from '@gambrel/router'
import type { Child } from '@gambrel/view'
import { formatBytes, formatCount, formatPercent, formatTimestamp } from '../../shared/format'
import { scanHref } from '../../shared/links'
import { AppHeader, Meter, StatusBadge } from '../components/chrome'
import type { loader } from './page.server'

export default function HomePage(props: PageProps<ParamsOf<'/'>, LoaderData<typeof loader>>): Child {
  const { drives, scans, error } = props.data
  return (
    <div class="app">
      <AppHeader current="drives" />
      <main class="shell wide">
        {error === null ? null : <p class="notice notice-error" role="alert">{error}</p>}
        <Card>
          <CardHeader>
            <CardTitle>Drives</CardTitle>
            <CardDescription>Choose a drive to scan. Scanning only reads the file system.</CardDescription>
          </CardHeader>
          <CardContent>
            {drives.length === 0 ? (
              <p class="muted">No drives were found.</p>
            ) : (
              <ul class="drives">
                {drives.map((drive) => {
                  const known = drive.totalBytes !== null && drive.freeBytes !== null && drive.totalBytes > 0
                  const used = known ? (drive.totalBytes ?? 0) - (drive.freeBytes ?? 0) : 0
                  const percent = known ? (used / (drive.totalBytes ?? 1)) * 100 : 0
                  return (
                    <li key={drive.path} class="drive">
                      <div class="drive-head">
                        <span class="drive-name">{drive.path}</span>
                        <form method="post" action="/actions/scan">
                          <input type="hidden" name="path" value={drive.path} />
                          <Button type="submit">Scan</Button>
                        </form>
                      </div>
                      {known ? (
                        <div>
                          <Meter percent={percent} />
                          <p class="muted num">{`${formatBytes(used)} used of ${formatBytes(drive.totalBytes ?? 0)} (${formatPercent(percent)})`}</p>
                        </div>
                      ) : (
                        <p class="muted">Capacity is not available.</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan a folder</CardTitle>
            <CardDescription>Enter an absolute path.</CardDescription>
          </CardHeader>
          <CardContent>
            <form class="path-form" method="post" action="/actions/scan">
              <Label for="path">Folder</Label>
              <Input id="path" name="path" placeholder="C:\Users" required />
              <Button type="submit">Scan</Button>
            </form>
          </CardContent>
        </Card>

        {scans.length === 0 ? null : (
          <Card>
            <CardHeader>
              <CardTitle>Recent scans</CardTitle>
              <CardDescription>Scans are kept in memory until the server stops.</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Folder</th>
                      <th>Status</th>
                      <th class="num-col">Files</th>
                      <th class="num-col">Size</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => (
                      <tr key={scan.id}>
                        <td class="name-cell"><a class="entry entry-dir" href={scanHref(scan.id)}>{scan.root}</a></td>
                        <td><StatusBadge status={scan.status} /></td>
                        <td class="num">{formatCount(scan.files)}</td>
                        <td class="num">{formatBytes(scan.bytes)}</td>
                        <td class="num muted">{formatTimestamp(scan.startedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
