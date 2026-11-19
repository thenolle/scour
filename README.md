# scour

A disk space analyzer for Windows, built with Bun, TypeScript and [Gambrel](https://github.com/thenolle/gambrel).

scour runs on your own machine and serves its interface on localhost. It reads the file system to show what is using your disk space. It does not send data anywhere.

## Status

scour is in early development. Disk analysis and a junk cleaner work. Uninstalling and install snapshots are planned and not yet available.

Available today:

- Scanning of any folder or drive, with live progress, a treemap, a sortable folder browser and a breakdown by file type. Symbolic links and junctions are not followed.
- Duplicate detection for files of 1 MiB or larger, using BLAKE2b-256 hashes. Hard links to the same data are reported as duplicates.
- A cleaner that finds temporary files, browser caches, developer caches (Cargo, NuGet, Gradle, npm, Bun, pip, and `node_modules` folders found by a scan) and downloaded AI models (Hugging Face, Ollama). Each item has a risk rating: safe, re-downloadable or needs review.
- A quarantine. The cleaner never deletes. It moves items into a quarantine folder with a manifest, and you can restore them. Items are deleted for good after 14 days by default.
- An uninstaller that lists installed programs, runs their uninstallers, and scans for leftover folders and registry keys. Folders go to the quarantine. Registry keys are exported to `.reg` files first and can be restored.

Scanning only reads the file system. The cleaner changes files only when you select items and confirm, and only by moving them into the quarantine.

Planned, in this order:

- Install snapshots: record the system before and after an installer runs, then remove what it added.

### Known limitations

- Only the 100 largest files in each folder are listed individually. Smaller files are counted in the totals.
- Sizes are logical file sizes, not space allocated on disk.
- Folders that Windows denies access to are counted as unreadable and skipped.
- Files that other programs have open cannot be moved to quarantine. The cleaner reports them and leaves them in place.
- Finding junk runs while the page waits, so it can take a while on drives with large caches.
- Leftover detection matches names only, so check each item. Removing machine-wide registry keys and folders under Program Files needs an elevated terminal.

## Requirements

- Bun 1.4.4 or newer.
- Git.
- Windows 10 or 11 for the disk features. CI builds the project on Linux and Windows.

## Getting started

```bash
git clone https://github.com/thenolle/scour.git
cd scour
bun install
bun run check
bun run start
```

`bun run check` regenerates the route manifests, runs the strict TypeScript check and builds the project. `bun run start` serves <http://127.0.0.1:4820>.

## Configuration

Settings are environment variables. See `.env.example`.

| Variable                 | Default                | Description                                                                         |
| ------------------------ | ---------------------- | ----------------------------------------------------------------------------------- |
| `SCOUR_HOST`             | `127.0.0.1`            | Bind address. Only loopback addresses are accepted.                                 |
| `SCOUR_PORT`             | `4820`                 | Listening port.                                                                     |
| `SCOUR_CLIENT_DIRECTORY` | `dist/client`          | Directory of the built browser assets, relative to the working directory.           |
| `SCOUR_DATA_DIRECTORY`   | `%LOCALAPPDATA%\scour` | Where scour keeps its quarantine. Other drives get a `.scour` folder in their root. |
| `SCOUR_QUARANTINE_DAYS`  | `14`                   | Days a quarantined item is kept before it is deleted for good (1 to 365).           |

## Security

scour has no sign-in because it is meant for one person on one machine. It refuses to bind to anything other than a loopback address, rejects requests whose `Host` header is not a loopback name, and rejects cross-origin requests that change state. Do not put it behind a reverse proxy or expose it to a network.

To report a vulnerability, read [SECURITY.md](SECURITY.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

scour is licensed under the [PolyForm Strict License 1.0.0](LICENSE) (`PolyForm-Strict-1.0.0`). It is source-available software, not open-source software.

In plain terms, the license allows you to use scour for noncommercial purposes: personal use, hobby projects, research, and use by charitable, educational, public research, public safety or health, environmental and government organisations. It does not allow you to distribute copies, modify the software or create derivative works, and it does not allow commercial use. A public repository does not grant any additional rights. Read the full [LICENSE](LICENSE) for the exact terms.

scour depends on Gambrel, which is also licensed under PolyForm Strict 1.0.0 by the same author.
