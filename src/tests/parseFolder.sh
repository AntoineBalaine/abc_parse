#!/bin/bash
# Loop through each file in the directory
find "$1" -name "*.abc" | while read -r file;
do
  # Run the pnpm start command with the file name
  error_output=$(pnpm start "$file" 2>&1 >/dev/null)

  # Check if there's an error in the stderr
  if [ -n "$error_output" ]; then
    echo "$file" >> ./error.log
    echo "$error_output\n" >> ./error.log
    echo >> ./error.log  # Append an empty line
    error_output=
  fi
done