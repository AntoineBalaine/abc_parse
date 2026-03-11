#!/bin/sh
#
# Generates a changelog section from git log, grouped by commit prefix.
#
# Usage:
#   sh docs-site/scripts/changelog.sh [from-tag] [to-ref]
#
# If both arguments are provided, generates the log between from-tag and to-ref.
# If only from-tag is provided, generates the log from from-tag to HEAD.
# If no arguments are provided, generates the log from the most recent tag to HEAD.

set -eu

from_ref="${1:-}"
to_ref="${2:-HEAD}"

if [ -z "$from_ref" ]; then
  from_ref=$(git describe --tags --abbrev=0 2>/dev/null || true)
  if [ -z "$from_ref" ]; then
    echo "Error: no tags found and no from-tag argument provided." >&2
    exit 1
  fi
fi

if [ "$to_ref" = "HEAD" ]; then
  version="Unreleased"
else
  version="$to_ref"
fi

date_str=$(date +%Y-%m-%d)

commits=$(git log --oneline "${from_ref}..${to_ref}" --format="%s")

if [ -z "$commits" ]; then
  echo "No commits found between ${from_ref} and ${to_ref}." >&2
  exit 0
fi

# Extract unique prefixes (the part before the colon), sorted.
prefixes=$(echo "$commits" | sed -n 's/^\([^:]*\): .*/\1/p' | sort -u)

# Build the markdown output.
tmpfile=$(mktemp)

echo "## ${version} (${date_str})" > "$tmpfile"
echo "" >> "$tmpfile"

for prefix in $prefixes; do
  echo "### ${prefix}" >> "$tmpfile"
  echo "" >> "$tmpfile"
  echo "$commits" | while IFS= read -r line; do
    case "$line" in
      "$prefix: "*)
        msg="${line#"$prefix": }"
        echo "- ${msg}" >> "$tmpfile"
        ;;
    esac
  done
  echo "" >> "$tmpfile"
done

# Collect any commits without a prefix.
others=$(echo "$commits" | grep -v '^[^:]*: ' || true)
if [ -n "$others" ]; then
  echo "### other" >> "$tmpfile"
  echo "" >> "$tmpfile"
  echo "$others" | while IFS= read -r line; do
    echo "- ${line}" >> "$tmpfile"
  done
  echo "" >> "$tmpfile"
fi

# Append to CHANGELOG.md (prepend after the first line if the file exists,
# or create it with a heading).
changelog="CHANGELOG.md"

if [ -f "$changelog" ]; then
  head_line=$(head -1 "$changelog")
  rest=$(tail -n +3 "$changelog")
  {
    echo "$head_line"
    echo ""
    cat "$tmpfile"
    echo "$rest"
  } > "$changelog"
else
  {
    echo "# Changelog"
    echo ""
    cat "$tmpfile"
  } > "$changelog"
fi

rm -f "$tmpfile"
echo "Changelog updated in ${changelog}."
