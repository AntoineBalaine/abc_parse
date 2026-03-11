#!/bin/bash
# Build and assemble the abcls npm package for publishing.
# Usage: bash abc-cli/publish.sh
# The publishable artifact is assembled in abc-cli/dist/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building abcls bundle..."
node esbuild.js

echo "Assembling publish directory..."
cp publish-package.json dist/package.json

if [ -f ../README.md ]; then
  cp ../README.md dist/README.md
fi

echo "Done. To publish:"
echo "  cd abc-cli/dist && npm publish"
echo "  (or: cd abc-cli/dist && npm pack --dry-run)"
