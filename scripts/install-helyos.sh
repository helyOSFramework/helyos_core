#!/bin/bash

set -e

# region FUNCTIONS
delete_dir() {
    local dir=$1
    
    if [ -d "$dir" ]; then
        sudo rm -rf "$dir"
    fi
}

reset_dir() {
    local dir=$1
    
    delete_dir $dir
    sudo mkdir -p $dir
}
# endregion

print "Resetting /usr/local/helyos_core"
reset_dir /usr/local/helyos_core
sudo cp LICENSE.txt /usr/local/helyos_core/LICENSE.txt

# region DASHBOARD
print "Setting up helyos_dashboard"
reset_dir /usr/src/app
sudo cp -r helyos_dashboard/* /usr/src/app
print "Running npm ci for helyos_dashboard"
sudo npm ci --prefer-offline --no-audit --no-fund --loglevel=error --prefix=/usr/src/app
print "Building helyos_dashboard"
sudo npm run build --prod --prefix=/usr/src/app
print "Resetting helyos_dashboard dist directory"
reset_dir /usr/local/helyos_core/helyos_dashboard/dist
print "Copying built files to helyos_dashboard dist"
sudo cp -r /usr/src/app/dist/* /usr/local/helyos_core/helyos_dashboard/dist
delete_dir /usr/src/app
# endregion

# region HELYOS CORE SERVER
print "Setting up helyos_server"
reset_dir /usr/local/helyos_core/helyos_server
sudo cp -r helyos_server/* /usr/local/helyos_core/helyos_server
sudo touch /usr/local/helyos_core/helyos_server/src/microservice_mocks.js
print "Running npm ci for helyos_server"
sudo npm ci --prefer-offline --no-audit --no-fund --loglevel=error --prefix=/usr/local/helyos_core/helyos_server
# endregion

# region DATABASE
print "Setting up helyos_database"
reset_dir /usr/local/helyos_core/helyos_database
sudo cp -r helyos_database/* /usr/local/helyos_core/helyos_database

print "Converting and setting permissions for migrate.sh"
sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/migrate.sh

print "Converting and setting permissions for create_admin_account.sh"
sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
# endregion

# region SETTINGS
print "Copying settings to /etc/helyos"
reset_dir /etc/helyos
sudo cp -r demo/settings/config /etc/helyos/config
sudo cp -r demo/settings/db_initial_data /etc/helyos/db_initial_data
sudo cp -r demo/settings/rsa_keys /etc/helyos/.ssl_keys
print "Setting permissions for SSL keys"
sudo chmod -R a-w,u+r /etc/helyos/.ssl_keys/*
# endregion

# region ENTRYPOINT FILES
print "Setting up entrypoint files"
reset_dir /usr/local/helyos_core/bin

print "Setting up wait-for-postgres.sh"
sudo cp packaging/wait-for-postgres.sh /usr/local/helyos_core/bin/wait-for-postgres.sh
sudo dos2unix /usr/local/helyos_core/bin/wait-for-postgres.sh
sudo chmod +x /usr/local/helyos_core/bin/wait-for-postgres.sh

print "Setting up entrypoint.sh"
sudo cp packaging/entrypoint.sh /usr/local/helyos_core/bin/entrypoint.sh
sudo dos2unix /usr/local/helyos_core/bin/entrypoint.sh
sudo chmod +x /usr/local/helyos_core/bin/entrypoint.sh
# endregion

print "Changing ownership of /usr/local/helyos_core to current user"
sudo chown -R $USER:$USER /usr/local/helyos_core

print "Script completed successfully!"

echo "helyos_dashboard: /usr/local/helyos_core/helyos_dashboard"
echo "helyos_server: /usr/local/helyos_core/helyos_server"
echo "helyos_database: /usr/local/helyos_core/helyos_database"
echo "entrypoint files: /usr/local/helyos_core/bin"
echo "configuration files: /etc/helyos/config/"
echo "initial data files for the database: /etc/helyos/db_initial_data/"
echo "SSL keys: /etc/helyos/.ssl_keys"
