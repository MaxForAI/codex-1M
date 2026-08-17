# Security Policy

## Supported versions

Security fixes are provided for the latest released version and the current
`main` branch. Older releases may be asked to upgrade before a fix is issued.

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/MaxForAI/codex-1M/security/advisories/new).
Do not open a public issue for a suspected vulnerability and do not include
tokens, credentials, or a real Codex configuration in a report.

Include the affected version, operating system, Codex CLI version, reproduction
steps using a disposable `CODEX_HOME`, expected impact, and any suggested
mitigation. Redact paths or configuration values that identify an account.

The maintainer aims to acknowledge a report within three business days, provide
an initial assessment within seven business days, and send updates at least
every fourteen days until remediation or closure. Timelines may vary with
severity and complexity. Coordinated disclosure will be agreed with the
reporter; please allow time for a fix and release before publishing details.

## Scope

Reports about unsafe configuration writes, command execution, dependency
vulnerabilities, and leakage of local data are in scope. Account access, model
availability, and vulnerabilities in Codex itself should be reported to OpenAI
through its official security channels.
