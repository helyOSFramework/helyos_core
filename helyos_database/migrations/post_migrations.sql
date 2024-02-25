--
-- This script is used to restore the data from the backup tables to the original tables.
-- Substitute 'helyos_db' with the name of your database.
--


-- Restore all tables from the backup, skipping the tables that you want to keep as they are.
DO  $$ 
DECLARE 
    table_name text;
    db_name text; 
    skip_tables text[] := ARRAY['table1_copy', 'table2_copy', 'table3_copy']; -- Define the array of table names to skip here 
BEGIN 
    db_name := current_database();
    PERFORM set_foreign_key_constraints_and_triggers(false, db_name);

    FOR table_name IN 
        SELECT ALLTABLES.table_name FROM information_schema.tables AS ALLTABLES
        WHERE ALLTABLES.table_schema = 'public' 
        AND ALLTABLES.table_name LIKE '%_copy' 
        AND ALLTABLES.table_catalog = db_name 
        AND ALLTABLES.table_name NOT LIKE ANY(skip_tables)
    LOOP
        PERFORM copy_common_columns(table_name, substring(table_name from 1 for length(table_name)-5)); 
        -- set the id sequence to the max id in the original table plus 1
        BEGIN
            EXECUTE format('SELECT setval(''%I_id_seq'', (SELECT MAX(id) FROM %I) + 1)', substring(table_name from 1 for length(table_name)-5), table_name);
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Sequence %I_id_seq does not exist', substring(table_name from 1 for length(table_name)-5);
        END;
    END LOOP; 

    PERFORM set_foreign_key_constraints_and_triggers(true, db_name);

END $$;


-- We may process here the tables that you skipped in the previous step.
-- For example, if you skipped the table 'table1_copy', you can transform the data from 'table1_copy' to 'table1' and then delete 'table1_copy'.
-- DO  $$
-- BEGIN
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- 
-- END $$;



-- Delete the backup tables
DO  $$ 
DECLARE 
    table_name text;
    db_name text;
    skip_tables text[] := ARRAY['table1_copy', 'table2_copy', 'table3_copy']; -- Define the array of table names to skip here 
BEGIN 
    db_name := current_database();
    FOR table_name IN 
        SELECT ALL_COPIED_TABLES.table_name 
        FROM information_schema.tables AS ALL_COPIED_TABLES
        WHERE table_schema = 'public' 
        AND ALL_COPIED_TABLES.table_name LIKE '%_copy' 
        AND table_catalog = db_name 
        AND ALL_COPIED_TABLES.table_name NOT LIKE ANY(skip_tables) 
    LOOP 
        EXECUTE format('DROP TABLE IF EXISTS %I', table_name); 
    END LOOP; 
END $$;