
-- This script is used to create a copy of all tables in the database and then drop the original tables.
-- Substitute 'helyos_db' with the name of your database.
--



-- Delete all backup tables
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


-- Create new backup tables, and delete the original tables.
DO $$ 
DECLARE 
    table_name text;
    db_name text; 
BEGIN 
    db_name := current_database();
    FOR table_name IN 
        SELECT ALLTABLES.table_name 
        FROM information_schema.tables AS ALLTABLES
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE' 
        AND table_catalog = db_name  
    LOOP 
        EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I', table_name || '_copy', table_name); 
        EXECUTE format('DROP TABLE %I CASCADE', table_name); 
    END LOOP; 
END $$;
