# Security

The scripts in `sh/` get piped to shells, so a problem with one matters more
than most bugs. Please report it privately through
[GitHub's private vulnerability reporting](https://github.com/taraxvoid/txv.sh/security/advisories/new),
not in a public issue.

Before you report, make sure the copy you have is genuine:
`gh attestation verify <file> --repo taraxvoid/txv.sh`. A script that fails
that check didn't come from this repo's CI.
