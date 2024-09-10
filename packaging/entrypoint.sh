#!/bin/bash
set -e

# if environment variable RUN_MODE is not set, set it to production
if [ -z "$RUN_MODE" ]; then
    RUN_MODE="production"
fi

if [ "$( psql -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" )" != '1' ];
then
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "Database  $PGDATABASE does not exist"
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "Start creating database '$PGDATABASE' now"
    psql -U "$PGUSER" --dbname="postgres" -c "CREATE DATABASE $PGDATABASE"
    echo "Database '$PGDATABASE' created successfully"
    CREATEDB="True"
    POPULATE_DB="True"
fi

# Migration to a new database schema 
if [ "$RUN_MODE" = "migration" ] || [ "$CREATEDB" = "True" ]; then
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "MIGRATE DATABASE"
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "END MIGRATION - set RUN_MODE to production to start the server"
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
fi

if [ "$RUN_MODE" = "db_init" ] || [ "$CREATEDB" = "True" ]; then
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "Start populating helyos_db database '$PGDATABASE'"
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    for file in  /etc/helyos/db_initial_data/*; do
        psql --dbname="$PGDATABASE" -f "${file}"
        # pg_restore  --data-only  -f "${file}"
    done
    echo "End populating database '$PGDATABASE'"
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
fi


# Ensure there is always a helyos admin account and a database role for graphql in the database 
/usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh

# Function to handle cleanup
cleanup() {
    echo "Received SIGTERM. Stopping the Node.js application..."
    kill $NODE_PID
    wait $NODE_PID
}


if [ "$RUN_MODE" = "production" ]; then
    # Run Nodejs backend
    if [ -f "/usr/local/helyos_core/helyos_server/helyos_core.app" ]; then
        echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        echo "RUN helyOS binary server"
        echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        /usr/local/helyos_core/helyos_server/helyos_core.app &
        NODE_PID=$!
    else
        echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        echo "RUN NODEJS helyOS server"
        echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        node /usr/local/helyos_core/helyos_server/src/main.js &
        NODE_PID=$!
    fi

    trap cleanup SIGTERM
    # Wait for the Node.js application to exit
    wait $NODE_PID
fi


if [ "$RUN_MODE" = "test" ]; then
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "RUN NODEJS and TEST"
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    nohup node /usr/local/helyos_core/helyos_server/src/main.js
    npm --prefix /usr/src/app run test
fi




exec "$@"

