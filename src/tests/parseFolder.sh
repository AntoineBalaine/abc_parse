#!/bin/bash
# Loop through each file in the directory
find "$1" -name "*.abc" | while read -r file;
do
  # Run the pnpm start command with the file name
  pnpm start "$file" 2>&1 | rg -i -q "error" && echo "found" && echo "$file" >> ./error.log

done