# Releasing

## Overview

Releases are automated via GitHub Actions. Pushing a version tag triggers the release workflow, which publishes:

- `abcls` to npm (CLI + LSP server bundle)
- `abcls-kak` to npm (Kakoune plugin, depends on `abcls`)
- `abcls` to the VS Code Marketplace

## Prerequisites

### GitHub Secrets

The following secrets must be configured in the repository settings:

- `NPM_TOKEN`: npm access token with publish permissions for the `abcls` and `abcls-kak` packages.
- `VSCE_PAT`: Visual Studio Marketplace personal access token for the `abcls` extension.

### Version Bumping

Before creating a tag, update the version in all `package.json` files and in the `publish-package.json` files. All packages use the same version number.

Files to update:

- Root `package.json`
- `parse/package.json`
- `editor/package.json`
- `cstree/package.json`
- `midi/package.json`
- `native/package.json`
- `abc-lsp-server/package.json`
- `abc-cli/package.json`
- `abc-kak/package.json`
- `preview-server/package.json`
- `vscode-extension/package.json`
- `abc-cli/publish-package.json`
- `abc-kak/publish-package.json` (also update the `abcls` dependency version)
- `abc-cli/abcls-cli.ts` (the `.version()` call in the commander setup)

## Creating a Release

1. Ensure all tests pass:

   ```bash
   npm run build:parse && npm run build:midi && npm run build:cstree && npm run build:editor && npm run build:lsp && npm run build:cli && npm run build:vscode && npm run build:preview && npm run build:kak
   npm test
   ```

2. Update version numbers (see list above).

3. Commit the version bump:

   ```bash
   git add -A
   git commit -m "chore: bump version to X.Y.Z"
   ```

4. Create and push the tag:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. The release workflow runs automatically. Monitor it at: `https://github.com/antoinebalaine/abc_parse/actions`

## Local Verification

Before pushing a tag, verify the packages locally:

```bash
# Build the abcls package
bash abc-cli/publish.sh
cd abc-cli/dist && npm pack --dry-run

# Build the abcls-kak package
bash abc-kak/publish.sh
cd abc-kak/publish-dist && npm pack --dry-run
```

## Workflows

- `.github/workflows/run_tests.yml`: runs on every PR, builds and tests the monorepo.
- `.github/workflows/release.yml`: runs on `v*` tag push, publishes to npm and VS Code Marketplace.
