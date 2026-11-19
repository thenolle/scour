# Contributing to scour

## Licensing of contributions

scour is released under the PolyForm Strict License 1.0.0, which does not permit distributing or modifying the software. By submitting a contribution you confirm that you wrote it or have the right to submit it, and you agree that the project owner may include it in scour under the project's license.

## Before you start

- Check existing issues and pull requests.
- Open an issue before starting a substantial change.
- Keep pull requests focused. Avoid unrelated formatting or structural changes.
- Do not add dependencies without a clear technical reason. The user interface uses Gambrel packages only.

## Development setup

```bash
git clone https://github.com/thenolle/scour.git
cd scour
bun install
```

## Quality checks

Run both before submitting:

```bash
bun run check
bun run licenses
```

`check` runs the strict type check and builds the project. `licenses` verifies that every installed package has an allowed license. The project has no automated test suite yet.

## Code conventions

- TypeScript strict mode. No `any`, `@ts-ignore` or unchecked assertions.
- Explicit types at public boundaries.
- Prefer native Bun and Web APIs.
- Keep modules small and single-purpose.
- Server-only code (file system, processes, configuration) must never be imported from browser code. Browser code may import types from server modules.

## Branches, commits and pull requests

- Work on a branch named after its commit type, such as `feat/scanner` or `fix/path-handling`.
- Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `refactor`, `perf`, `build`, `ci`, `chore` or `test`.
- Pull requests are squash-merged into `master`. CI must pass.
- A pull request explains the problem, describes the solution, links related issues and lists how it was verified.

## Reporting bugs

Open an issue with reproduction steps, the expected and actual behaviour, and your Windows and Bun versions.
