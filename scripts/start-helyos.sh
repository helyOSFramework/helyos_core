#!/bin/bash

set -e

# Load environment variables from .env file
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
fi

cd /usr/local/helyos_core/helyos_server

bash /usr/local/helyos_core/bin/wait-for-postgres.sh
bash /usr/local/helyos_core/bin/entrypoint.sh
