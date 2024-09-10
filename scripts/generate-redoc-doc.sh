#!/bin/bash

set -e

helyos_server_path=/usr/local/helyos_core/helyos_server

if [ ! -d "$helyos_server_path" ]; then
  echo "Error: Directory $helyos_server_path does not exist."
  exit 1
fi

cd $helyos_server_path

# generate redoc static api documentation instead of using swagger on the fly
npm install --no-save redoc-cli
npm run make_map_api_doc
npm run make_path_api_doc
npm uninstall redoc-cli
