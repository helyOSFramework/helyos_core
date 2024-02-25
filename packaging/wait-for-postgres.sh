#!/bin/sh
# wait-for-postgres.sh

set -e

host="$PGHOST"
PGPASSWORD="$PGPASSWORD"
cmd="$@"

# Check if required environment variables are set
if [ -z "$host" ] || [ -z "$PGPASSWORD" ] || [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
    >&2 echo "Required environment variables are not set. Please make sure to set PGHOST, PGPASSWORD, PGUSER, and PGDATABASE."
    exit 1
fi


until psql -U "$PGUSER" --dbname="postgres" -c '\q' || psql -U "$PGUSER" --dbname="$PGDATABASE" -c '\q'; do
    >&2 echo "The default 'postgres' database or '$PGDATABASE' database is not available - sleeping"
    sleep 1
done


>&2 echo "Postgres is up - executing command"

echo "HELYOS is able to connect to Database  '$PGDATABASE"

exec $cmd


