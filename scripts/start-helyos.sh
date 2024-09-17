#!/bin/bash

set -e

source functions.sh

# Function to handle SIGTERM
cleanup() {
    print_info "Received SIGTERM. Shutting down gracefully"
    if [ -n "$CHILD_PID" ]; then
        print_info "Killing /usr/local/helyos_core/bin/entrypoint.sh with PID $CHILD_PID"
        kill -SIGTERM "$CHILD_PID"
    fi
    exit 0
}

# Load environment variables from .env file
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
else
    print_fail "Error: File .env does not exist."
    exit 1
fi

cd /usr/local/helyos_core/helyos_server

trap cleanup SIGTERM

bash /usr/local/helyos_core/bin/wait-for-postgres.sh
bash /usr/local/helyos_core/bin/entrypoint.sh &
CHILD_PID=$!

# Wait for child process to complete
wait "$CHILD_PID"