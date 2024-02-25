#!/bin/bash

# Delete all backup tables
psql --dbname="$PGDATABASE"  -c "
DO $$ 
DECLARE 
    table_name text;
    db_name text;
BEGIN 
    db_name := current_database();
    FOR table_name IN 
        SELECT ALL_COPIED_TABLES.table_name 
        FROM information_schema.tables AS ALL_COPIED_TABLES
        WHERE table_schema = 'public' 
        AND ALL_COPIED_TABLES.table_name LIKE '%_copy' 
        AND table_catalog = db_name 
    LOOP 
        EXECUTE format('DROP TABLE IF EXISTS %I', table_name); 
    END LOOP; 
END $$;
"
