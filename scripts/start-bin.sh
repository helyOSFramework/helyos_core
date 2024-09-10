#!/bin/bash

set -e

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  echo "Error: Directory /usr/local/helyos_core/helyos_server does not exist."
  exit 1
fi

# Load environment variables from .env file
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
else
  echo "Error: File .env does not exist."
  exit 1
fi


cd /usr/local/helyos_core/helyos_server
/usr/local/helyos_core/helyos_server/helyos_core.app
