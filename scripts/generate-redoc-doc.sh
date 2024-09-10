#!/bin/bash

set -e

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  echo "Error: Directory /usr/local/helyos_core/helyos_server does not exist."
  exit 1
fi

cd /usr/local/helyos_core/helyos_server

# generate redoc static api documentation instead of using swagger on the fly
npm install --no-save redoc-cli
npm run make_map_api_doc
npm run make_path_api_doc
npm uninstall redoc-cli
