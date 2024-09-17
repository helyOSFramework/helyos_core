#!/bin/bash

set -e

source functions.sh

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  print_fail "Error: Directory /usr/local/helyos_core/helyos_server does not exist"
  exit 1
fi

cd /usr/local/helyos_core/helyos_server

print_info "Creating binary from helyos_server"

npm install --prefer-offline --no-audit --no-fund --loglevel=error --no-save pkg
npx pkg --o /usr/local/helyos_core/helyos_server/helyos_core.app --targets node18-linuxstatic-x64 /usr/local/helyos_core/helyos_server/src/main.js 
chmod +x /usr/local/helyos_core/helyos_server/helyos_core.app

print_info "Binary created sucessfully at /usr/local/helyos_core/helyos_server/helyos_core.app"
