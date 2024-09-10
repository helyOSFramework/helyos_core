#!/bin/bash

set -e

source functions.sh

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  print_fail "Error: Directory /usr/local/helyos_core/helyos_server does not exist."
  exit 1
fi

cd /usr/local/helyos_core/helyos_server

print_success "Generating redoc static API documentation"

npm install --prefer-offline --no-audit --no-fund --loglevel=error --no-save redoc-cli
npm run make_map_api_doc
npm run make_path_api_doc

print_success "API documentation created sucessfully at /usr/local/helyos_core/helyos_server/docs"
