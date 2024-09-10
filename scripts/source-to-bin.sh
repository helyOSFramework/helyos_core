#!/bin/bash

set -e

helyos_server_path=/usr/local/helyos_core/helyos_server

if [ ! -d "$helyos_server_path" ]; then
  echo "Error: Directory $helyos_server_path does not exist."
  exit 1
fi

cd $helyos_server_path

npm install --no-save pkg
npx pkg --o $helyos_server_path/helyos_core.app --targets node18-linuxstatic-x64 $helyos_server_path/src/main.js 
chmod +x $helyos_server_path/helyos_core.app
npm uninstall pkg
