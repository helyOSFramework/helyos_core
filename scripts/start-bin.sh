#!/bin/bash

set -e

source functions.sh

if [ ! -d "/usr/local/helyos_core/helyos_server" ]; then
  print_fail "Error: Directory /usr/local/helyos_core/helyos_server does not exist"
  exit 1
fi

# Load environment variables from .env file
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
else
  print_fail "Error: File .env does not exist"
  exit 1
fi


cd /usr/local/helyos_core/helyos_server
/usr/local/helyos_core/helyos_server/helyos_core.app
