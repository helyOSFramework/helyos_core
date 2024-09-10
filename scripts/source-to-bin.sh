#!/bin/bash

set -e

helyos_server_path=/usr/local/helyos_core/helyos_server
cd $helyos_server_path

npm install pkg
npx pkg --o $helyos_server_path/helyos_core.app --targets node18-linuxstatic-x64 $helyos_server_path/src/main.js 
chmod +x $helyos_server_path/helyos_core.app
npm uninstall pkg
