#!/bin/bash

set -e

# PostgreSQL connection details
HOST="127.0.0.1"         # The host where Docker is running
PORT="5433"              # The port on the host where PostgreSQL is exposed
USER="helyos_db_admin"   # PostgreSQL username
DATABASE="smartfarm_db" # PostgreSQL database name
PASSWORD="helyos_secret" # PostgreSQL password

# Connect to PostgreSQL using psql with password
echo PGPASSWORD="$PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE"
PGPASSWORD="$PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE"
