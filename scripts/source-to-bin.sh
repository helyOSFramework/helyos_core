#!/bin/bash

set -e

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  echo "Error: Directory /usr/local/helyos_core/helyos_server does not exist."
  exit 1
fi

cd /usr/local/helyos_core/helyos_server

# convert the source code to a single binary file
npm install --no-save pkg
npx pkg --o /usr/local/helyos_core/helyos_server/helyos_core.app --targets node18-linuxstatic-x64 /usr/local/helyos_core/helyos_server/src/main.js 
chmod +x /usr/local/helyos_core/helyos_server/helyos_core.app
npm uninstall pkg

echo "Binary created sucessfully at /usr/local/helyos_core/helyos_server/helyos_core.app"
