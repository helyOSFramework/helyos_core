## Database commands.

Before starting to use **helyos core**, it is necessary to create an admin account by running the `create_admin_account.sh` script.

When a new version of **helyos core** is released, there may be changes in the database schema. To migrate your database, you can use the `migrate.sh` script, which provides a simple strategy for copying the current database to the new one while ignoring any mismatches between tables and columns. However, for more significant changes in the database, you will need to manually edit the `migrations/pre_migrations.sql` and `migrations/post_migrations.sql` scripts to adapt your data to the new database structure.

