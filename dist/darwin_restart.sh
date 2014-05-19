#!/bin/bash

# this bash wrapper is used by the auto-udpate mechanism to restart the entire
# process after the update was installed. It makes sure that:
# - we wait for the older process to shutdown entirely
# - we disable quarantine of the newly downloaded package

destination=$1

# Wait until all processes from within the bundle are closed
echo -n "Waiting for bundled processes to close..."
while [ $(
  # List all processes, filtering out this process
  processes=$(echo "$(ps ax)" | grep -v "$0")

  # Escape the destination into a regexp that matches it
  regexp=$(echo "$destination" | sed 's/[^[:alnum:]_-]/\\&/g')

  # Filters entries matching the regexp, and do some magic to preserve the trailing newline
  matches=$(echo "$processes" | awk "/$regexp/ { print \$1 }"; echo .)
  matches=${matches%.}

  # Count matches
  printf "%s" "$matches" | wc -l
  ) -gt 0 ]
do
  echo -n .
  sleep 1
done
echo

echo "Make sure destination is not quarantined..."
xattr -d com.apple.quarantine "$destination"

# (Re)launch the destination bundle
echo "Relaunching bundle..."
open "$destination"

echo "Done."
