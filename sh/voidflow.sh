#!/bin/sh
# Run a pinned, attested voidflow release (e.g. init --kind tool)
#
#   curl -fsSL txv.sh/voidflow | sh -s -- <command> [flags]
#   curl -fsSL txv.sh/voidflow | sh -s -- init --kind tool
#
# Downloads the pinned @taraxvoid/voidflow tarball from npm, checks its GitHub
# attestation (voidflow's release workflow, on a GitHub-hosted runner), then
# runs the voidflow bin from those same bytes with bun. Nothing is installed:
# the tarball lives in a temp dir that is removed on exit. Uses bun and gh if
# installed, else `mise x`. gh must be signed in (`gh auth login`).
#
# Everything is inside main() so sh has read the whole file before anything
# runs: a half-downloaded script does nothing.
set -eu

gh_() {
    if command -v gh >/dev/null 2>&1; then
        gh "$@"
    else
        mise x gh -- gh "$@"
    fi
}

bun_() {
    if command -v bun >/dev/null 2>&1; then
        bun "$@"
    else
        mise x bun -- bun "$@"
    fi
}

has() {
    command -v "$1" >/dev/null 2>&1
}

main() {
    pkg=@taraxvoid/voidflow
    # renovate: datasource=npm depName=@taraxvoid/voidflow
    version=1.0.0-next.3
    repo=taraxvoid/voidflow
    url=https://registry.npmjs.org/$pkg/-/voidflow-$version.tgz

    if ! has mise; then
        for tool in bun gh; do
            if ! has "$tool"; then
                echo "voidflow: needs $tool, or mise (https://mise.jdx.dev) to run it" >&2
                exit 1
            fi
        done
    fi

    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    file="$tmp/voidflow-$version.tgz"
    curl -fsSL "$url" -o "$file"

    gh_ attestation verify "$file" \
        --repo "$repo" \
        --signer-workflow "$repo/.github/workflows/release-please.yml" \
        --deny-self-hosted-runners >&2

    tar -xzf "$file" -C "$tmp"
    # The attestation says voidflow's release built this tarball; make sure
    # it is the release that is pinned here.
    if ! grep -q "\"version\": \"$version\"" "$tmp/package/package.json"; then
        echo "voidflow: $url is not version $version" >&2
        exit 1
    fi

    bun_ "$tmp/package/dist/scripts/cli.js" "$@"
}

main "$@"
