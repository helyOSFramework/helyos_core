#!/bin/sh
# migrate.sh

set -e

host="$PGHOST"
PGPASSWORD="$PGPASSWORD"

psql --dbname="$PGDATABASE" -f /usr/local/helyos_core/helyos_database/db_stored_procedures/utils.sql


if [ -f "/usr/local/helyos_core/helyos_database/migrations/pre_migrations.sql" ]; then
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "Running pre_migrations.sql: changes before adapting to new schema in '$PGDATABASE'"
    psql -q --dbname=$PGDATABASE  -v PGDATABASE="$PGDATABASE" -f "/usr/local/helyos_core/helyos_database/migrations/pre_migrations.sql"   
    echo "End pre-migration data updates '$PGDATABASE'"
fi


echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo " Update schema helyos database '$PGDATABASE'"
for file in /usr/local/helyos_core/helyos_database/db_schema/*; do
    psql -q --dbname=$PGDATABASE -f "${file}"
done
echo "End update schema database '$PGDATABASE'"
echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"


if [ -f "/usr/local/helyos_core/helyos_database/migrations/post_migrations.sql" ]; then
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "Running post_migrations.sql: changes after updating to new schema in '$PGDATABASE'"
    psql --dbname="$PGDATABASE"  -v PGDATABASE="$PGDATABASE" -f "/usr/local/helyos_core/helyos_database/migrations/post_migrations.sql"    
    echo "End pos-migration data updates '$PGDATABASE'"
    echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
fi


echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo "CREATE POSTGRESS ROLES AND FUNCTIONS "
psql -U "$PGUSER" --dbname="$PGDATABASE" -c "CREATE ROLE role_postgraphile WITH LOGIN PASSWORD'$PGPASSWORD';" || true;
psql -q --dbname=$PGDATABASE -f /usr/local/helyos_core/helyos_database/postgres_roles.sql
for file in  /usr/local/helyos_core/helyos_database/db_stored_procedures/*; do
    psql -q --dbname=$PGDATABASE -f "${file}"
done
echo " END CREATE POSTGRESS FUNCTIONS AND ROLES"
echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo "MIGRATION DONE"
echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"