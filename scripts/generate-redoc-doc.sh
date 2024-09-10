#!/bin/bash

set -e

cd /usr/local/helyos_core/helyos_server

# generate redoc static api documentation instead of using swagger on the fly

npm install redoc-cli
npm run make_map_api_doc
npm run make_path_api_doc
