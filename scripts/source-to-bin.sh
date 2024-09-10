#!/bin/bash

set -e

# Define color codes
GREEN='\033[0;32m'
NC='\033[0m' # No Color

print() {
    echo -e "\n${GREEN}### $1...${NC}"
}

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  echo "Error: Directory /usr/local/helyos_core/helyos_server does not exist."
  exit 1
fi

cd /usr/local/helyos_core/helyos_server

# convert the source code to a single binary file
print "Creating binary from helyos_server"

npm install --prefer-offline --no-audit --no-fund --loglevel=error --no-save pkg
npx pkg --o /usr/local/helyos_core/helyos_server/helyos_core.app --targets node18-linuxstatic-x64 /usr/local/helyos_core/helyos_server/src/main.js 
chmod +x /usr/local/helyos_core/helyos_server/helyos_core.app

print "Binary created sucessfully at /usr/local/helyos_core/helyos_server/helyos_core.app"
