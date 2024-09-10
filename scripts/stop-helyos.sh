#!/bin/bash

source functions.sh

PROCESS_NAME="start-helyos.sh"

# Find the PIDs of the processes with the given name
PIDS=$(pgrep -f "$PROCESS_NAME")

if [ -z "$PIDS" ]; then
    print_fail "No processes found with the name: $PROCESS_NAME"
    exit 1
fi

# Send SIGTERM to each PID
for PID in $PIDS; do
    echo "Sending SIGTERM to process $PROCESS_NAME with PID $PID"
    kill -SIGTERM "$PID"
done

print_info "SIGTERM signal sent to all matching processes"
