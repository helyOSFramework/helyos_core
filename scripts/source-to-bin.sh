#!/bin/bash

set -e

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  echo "Error: Directory /usr/local/helyos_core/helyos_server does not exist."
  exit 1
fi

source functions.sh

# Export all functions defined in functions.sh
export -f $(declare -F | awk '{print $3}')

cd /usr/local/helyos_core/helyos_server

# convert the source code to a single binary file
print "Creating binary from helyos_server"

npm install --prefer-offline --no-audit --no-fund --loglevel=error --no-save pkg
npx pkg --o /usr/local/helyos_core/helyos_server/helyos_core.app --targets node18-linuxstatic-x64 /usr/local/helyos_core/helyos_server/src/main.js 
chmod +x /usr/local/helyos_core/helyos_server/helyos_core.app

print "Binary created sucessfully at /usr/local/helyos_core/helyos_server/helyos_core.app"
