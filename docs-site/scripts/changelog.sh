#!/usr/bin/env bash
#
# Generates a changelog section from git log, grouped by commit prefix.
#
# Usage:
#   bash docs-site/scripts/changelog.sh [from-tag] [to-ref]
#
# If both arguments are provided, generates the log between from-tag and to-ref.
# If only from-tag is provided, generates the log from from-tag to HEAD.
# If no arguments are provided, generates the log from the most recent tag to HEAD.

set -euo pipefail

from_ref="${1:-}"
to_ref="${2:-HEAD}"

if [ -z "$from_ref" ]; then
  from_ref=$(git describe --tags --abbrev=0 2>/dev/null || true)
  if [ -z "$from_ref" ]; then
    echo "Error: no tags found and no from-tag argument provided." >&2
    exit 1
  fi
fi

# Determine the version label from to_ref (use tag name if it looks like a version,
# otherwise use the ref as-is).
if [ "$to_ref" = "HEAD" ]; then
  version="Unreleased"
else
  version="$to_ref"
fi

date_str=$(date +%Y-%m-%d)

# Collect commits as "prefix|message" lines.
commits=$(git log --oneline "${from_ref}..${to_ref}" --format="%s")

if [ -z "$commits" ]; then
  echo "No commits found between ${from_ref} and ${to_ref}." >&2
  exit 0
fi

# Parse each commit into prefix and message, then group by prefix.
declare -A groups

while IFS= read -r line; do
  if [[ "$line" =~ ^([^:]+):\ (.+)$ ]]; then
    prefix="${BASH_REMATCH[1]}"
    msg="${BASH_REMATCH[2]}"
  else
    prefix="other"
    msg="$line"
  fi

  if [ -z "${groups[$prefix]+x}" ]; then
    groups[$prefix]="- ${msg}"
  else
    groups[$prefix]="${groups[$prefix]}
- ${msg}"
  fi
done <<< "$commits"

# Build the markdown output.
output="## ${version} (${date_str})

"

# Sort the prefixes for consistent output.
sorted_prefixes=$(echo "${!groups[@]}" | tr ' ' '\n' | sort)

for prefix in $sorted_prefixes; do
  output+="### ${prefix}

${groups[$prefix]}

"
done

# Append to CHANGELOG.md (prepend after the first line if the file exists,
# or create it with a heading).
changelog="CHANGELOG.md"

if [ -f "$changelog" ]; then
  # Insert the new section after the first heading line.
  head_line=$(head -1 "$changelog")
  rest=$(tail -n +2 "$changelog")
  {
    echo "$head_line"
    echo ""
    echo "$output"
    echo "$rest"
  } > "$changelog"
else
  {
    echo "# Changelog"
    echo ""
    echo "$output"
  } > "$changelog"
fi

echo "Changelog updated in ${changelog}."
