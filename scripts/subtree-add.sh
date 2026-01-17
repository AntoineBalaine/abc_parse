#!/bin/bash
# Manual git subtree add - works around git 2.51.0 bug
# Usage: ./subtree-add.sh <prefix> <repo> <ref>

set -e

PREFIX="$1"
REPO="$2"
REF="$3"

if [ -z "$PREFIX" ] || [ -z "$REPO" ] || [ -z "$REF" ]; then
    echo "Usage: $0 <prefix> <repo> <ref>"
    echo "Example: $0 abcjs-renderer /workspace/abcjs-vscode master"
    exit 1
fi

# Ensure prefix has no trailing slash for consistency
PREFIX="${PREFIX%/}"

echo "==> Fetching $REF from $REPO..."
git fetch "$REPO" "$REF"
FETCH_REV=$(git rev-parse FETCH_HEAD)

echo "==> Source commit: $FETCH_REV"

# Get current HEAD
HEAD_REV=$(git rev-parse HEAD)
echo "==> Current HEAD: $HEAD_REV"

# Stage the fetched tree under the prefix
echo "==> Staging files under $PREFIX/..."
git read-tree --prefix="$PREFIX/" "$FETCH_REV"

# Checkout the staged files to working tree
echo "==> Checking out files..."
git checkout -- "$PREFIX/"

# Write the combined tree
echo "==> Writing tree..."
TREE=$(git write-tree)

# Create the merge commit with two parents
# This is what preserves the history from both repos
echo "==> Creating merge commit..."
COMMIT=$(git commit-tree "$TREE" \
    -p "$HEAD_REV" \
    -p "$FETCH_REV" \
    -m "Add '$PREFIX/' from $REPO

git-subtree-dir: $PREFIX
git-subtree-mainline: $HEAD_REV
git-subtree-split: $FETCH_REV")

# Update HEAD to point to the new commit
echo "==> Updating HEAD..."
git reset "$COMMIT"

echo "==> Done! Created merge commit: $COMMIT"
echo ""
echo "The history from $REPO is now part of this repo under $PREFIX/"
echo "You can verify with: git log --oneline --graph $PREFIX/"
