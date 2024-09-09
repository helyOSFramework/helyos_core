#!/bin/bash

set -e

# Load environment variables from .env file
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
fi

bash /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
bash /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
bash /usr/local/helyos_core/bin/wait-for-postgres.sh
bash /usr/local/helyos_core/bin/entrypoint.sh
