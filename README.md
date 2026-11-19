# scour

A disk space analyzer for Windows, built with Bun, TypeScript and [Gambrel](https://github.com/thenolle/gambrel).

scour runs on your own machine and serves its interface on localhost. It reads the file system to show what is using your disk space. It does not send data anywhere.

## Status

scour is in early development. Disk analysis works. Cleaning, uninstalling and install snapshots are planned and not yet available.

Available today:

- Scanning of any folder or drive. Folders are read one at a time, and symbolic links and junctions are not followed.
- Live progress over a local WebSocket while a scan runs.
- A treemap of the largest items in any folder, a sortable folder browser and a breakdown by file type.
- Duplicate detection for files of 1 MiB or larger, using BLAKE2b-256 hashes. Hard links to the same data are reported as duplicates.

scour only reads the file system. It does not modify or delete files.

Planned, in this order:

- Cleaning: temporary files and developer caches (browser caches, `node_modules`, Cargo, NuGet, Gradle, Hugging Face, Ollama), each with a risk rating. Deleted items go to a restorable quarantine first.
- Uninstalling: installed programs with their leftover files and registry entries, and a registry backup before any change.
- Install snapshots: record the system before and after an installer runs, then remove what it added.

### Known limitations

- Only the 100 largest files in each folder are listed individually. Smaller files are counted in the totals.
- Sizes are logical file sizes, not space allocated on disk.
- Folders that Windows denies access to are counted as unreadable and skipped.

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

| Variable                 | Default       | Description                                                               |
| ------------------------ | ------------- | ------------------------------------------------------------------------- |
| `SCOUR_HOST`             | `127.0.0.1`   | Bind address. Only loopback addresses are accepted.                       |
| `SCOUR_PORT`             | `4820`        | Listening port.                                                           |
| `SCOUR_CLIENT_DIRECTORY` | `dist/client` | Directory of the built browser assets, relative to the working directory. |

## Security

scour has no sign-in because it is meant for one person on one machine. It refuses to bind to anything other than a loopback address, rejects requests whose `Host` header is not a loopback name, and rejects cross-origin requests that change state. Do not put it behind a reverse proxy or expose it to a network.

To report a vulnerability, read [SECURITY.md](SECURITY.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

scour is licensed under the [PolyForm Strict License 1.0.0](LICENSE) (`PolyForm-Strict-1.0.0`). It is source-available software, not open-source software.

In plain terms, the license allows you to use scour for noncommercial purposes: personal use, hobby projects, research, and use by charitable, educational, public research, public safety or health, environmental and government organisations. It does not allow you to distribute copies, modify the software or create derivative works, and it does not allow commercial use. A public repository does not grant any additional rights. Read the full [LICENSE](LICENSE) for the exact terms.

scour depends on Gambrel, which is also licensed under PolyForm Strict 1.0.0 by the same author.
