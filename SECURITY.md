# Security Policy

## Reporting a vulnerability

Do not disclose security vulnerabilities through public GitHub issues, discussions or pull requests.

Use GitHub's private vulnerability reporting:

https://github.com/thenolle/scour/security/advisories/new

Include:

- A description of the vulnerability.
- The affected components or versions.
- Steps to reproduce the issue.
- The potential impact.
- Any relevant proof of concept.

Avoid including real credentials, personal information or sensitive data in reports.

## Supported versions

scour is in early development. Security fixes are made on the latest development version. Supported release versions will be listed here once stable releases exist.

## Design notes

- scour has no authentication. It is a single-user tool and binds to loopback addresses only.
- Requests must carry a loopback `Host` header. Requests that change state, and WebSocket upgrades, are refused when their `Origin` differs from the host they were sent to.
- The cleaner never receives paths from the browser. It receives ids that refer to the last detection, and re-checks every item before moving it. It refuses paths less than three levels below a drive root, never follows links, and only moves items into the quarantine. The quarantine manifest is validated when it is read.
- Items are deleted for good only when their retention period ends or when you choose Delete now.
- The registry surgeon only removes uninstall entries and single vendor keys directly under `SOFTWARE`, never protected vendors such as Microsoft, and only after the key has been exported to a `.reg` file.
