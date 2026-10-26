#!/bin/sh
# Download a txv.sh script, check its GitHub attestation, then run it
#
#   curl -fsSL txv.sh/verify | sh -s -- <name> [args...]
#
# The attestation must come from this repo's CI on main, on a GitHub-hosted
# runner. Uses gh if installed, else `mise x gh`. gh must be signed in
# (`gh auth login`) to query attestations.
#
# Everything is inside main() so sh has read the whole file before anything
# runs: the script being run can't read the rest of this one from the pipe.
set -eu

gh_() {
    if command -v gh >/dev/null 2>&1; then
        gh "$@"
    else
        mise x gh -- gh "$@"
    fi
}

main() {
    repo=taraxvoid/txv.sh
    base=${TXV_BASE:-https://txv.sh}

    if [ $# -lt 1 ]; then
        echo "usage: curl -fsSL txv.sh/verify | sh -s -- <name> [args...]" >&2
        exit 2
    fi
    name=$1
    shift
    case $name in
    '' | *[!a-z0-9-]*)
        echo "txv.sh: bad script name: $name" >&2
        exit 2
        ;;
    esac
    if ! command -v gh >/dev/null 2>&1 && ! command -v mise >/dev/null 2>&1; then
        echo "txv.sh: verifying needs gh (https://cli.github.com) or mise (https://mise.jdx.dev)" >&2
        exit 1
    fi

    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    file="$tmp/$name.sh"
    curl -fsSL "$base/$name" -o "$file"

    gh_ attestation verify "$file" \
        --repo "$repo" \
        --source-ref refs/heads/main \
        --signer-workflow "$repo/.github/workflows/ci.yml" \
        --deny-self-hosted-runners >&2

    sh "$file" "$@"
}

main "$@"
