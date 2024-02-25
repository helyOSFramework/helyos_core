-- Copy the data from one table to another ignoring missing columns
CREATE OR REPLACE FUNCTION copy_common_columns(table1 text, table2 text)
RETURNS VOID AS
$$
DECLARE
    common_columns text[];
    sql_query text;
BEGIN
    SELECT array_agg(column_name)
    INTO common_columns
    FROM information_schema.columns
    WHERE table_name = table1 AND table_schema = 'public'
          AND column_name IN (SELECT column_name FROM information_schema.columns WHERE table_name = table2 AND table_schema = 'public');

    sql_query := 'INSERT INTO ' || table2 || ' (' || array_to_string(common_columns, ', ') || ') ' ||
                 'SELECT ' || array_to_string(common_columns, ', ') || ' FROM ' || table1;

    EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql;


-- Disable or enable all foreign-key constraints and triggers before inserting the data backup back to the original tables.
CREATE OR REPLACE FUNCTION set_foreign_key_constraints_and_triggers(enabled BOOLEAN, database_name text)
RETURNS VOID AS
$$
DECLARE
    table_name text;    
BEGIN
    FOR table_name IN 
        SELECT ALLTABLES.table_name FROM information_schema.tables AS ALLTABLES
        WHERE ALLTABLES.table_schema = 'public'  AND ALLTABLES.table_catalog = database_name 
    LOOP
        IF enabled THEN
            EXECUTE format('ALTER TABLE %I ENABLE TRIGGER ALL;',table_name);
        ELSE
            EXECUTE format('ALTER TABLE %I DISABLE TRIGGER ALL;',table_name);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

