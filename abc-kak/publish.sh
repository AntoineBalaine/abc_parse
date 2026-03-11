#!/bin/bash
# Build and assemble the abcls-kak npm package for publishing.
# Usage: bash abc-kak/publish.sh
# The publishable artifact is assembled in abc-kak/publish-dist/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building abcls-kak bundle..."
node esbuild-publish.js

PUBLISH_DIR="publish-dist"
rm -rf "$PUBLISH_DIR"
mkdir -p "$PUBLISH_DIR/dist"
mkdir -p "$PUBLISH_DIR/rc"

echo "Assembling publish directory..."
cp publish-package.json "$PUBLISH_DIR/package.json"
cp dist/abc-kak-client.js "$PUBLISH_DIR/dist/abc-kak-client.js"
cp dist/install.js "$PUBLISH_DIR/dist/install.js"
cp -r rc/* "$PUBLISH_DIR/rc/"

if [ -f README.md ]; then
  cp README.md "$PUBLISH_DIR/README.md"
fi

echo "Done. To publish:"
echo "  cd abc-kak/publish-dist && npm publish"
echo "  (or: cd abc-kak/publish-dist && npm pack --dry-run)"
