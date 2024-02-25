### Migration Scripts

Before running the migration command `db_commands/migrate.sh` , make sure to edit the `pre_migrations.sql` and `post_migration.sql` files. 

The `pre_migrations` script saves tables with their data by creating a copy of each table with the suffix `_copy` and then deleting the original tables.

The `post_migrations` script recovers the data from the backup, ignoring any table columns that do not match with the migrated database.
