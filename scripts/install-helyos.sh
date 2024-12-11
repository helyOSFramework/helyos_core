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

# region DIRECTORY SETUP
reset_dir /usr/local/helyos_core
reset_dir /usr/src/app
reset_dir /usr/local/helyos_core/helyos_dashboard/dist
reset_dir /usr/local/helyos_core/helyos_server
reset_dir /usr/local/helyos_core/helyos_database
reset_dir /etc/helyos
reset_dir /usr/local/helyos_core/bin

print_info "Changing ownership of /usr/local/helyos_core /usr/src/app /etc/helyos to current user"
sudo chown -R $USER:$USER /usr/local/helyos_core /usr/src/app /etc/helyos
# endregion

print_info "Resetting /usr/local/helyos_core"
cp LICENSE.txt /usr/local/helyos_core/LICENSE.txt

# region DASHBOARD
print_info "Setting up helyos_dashboard"
cp -r helyos_dashboard/* /usr/src/app
print_info "Running npm ci for helyos_dashboard"
npm ci --prefer-offline --no-audit --no-fund --loglevel=error --prefix=/usr/src/app
print_info "Building helyos_dashboard"
npm run build --prod --prefix=/usr/src/app
print_info "Resetting helyos_dashboard dist directory"
print_info "Copying built files to helyos_dashboard dist"
cp -r /usr/src/app/dist/* /usr/local/helyos_core/helyos_dashboard/dist
delete_dir /usr/src/app
# endregion

# region HELYOS CORE SERVER
print_info "Setting up helyos_server"
cp -r helyos_server/* /usr/local/helyos_core/helyos_server
touch /usr/local/helyos_core/helyos_server/src/microservice_mocks.js
print_info "Running npm ci for helyos_server"
npm ci --prefer-offline --no-audit --no-fund --loglevel=error --prefix=/usr/local/helyos_core/helyos_server
# endregion

# region DATABASE
print_info "Setting up helyos_database"
cp -r helyos_database/* /usr/local/helyos_core/helyos_database

print_info "Converting and setting permissions for migrate.sh"
dos2unix /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
chmod +x /usr/local/helyos_core/helyos_database/db_commands/migrate.sh

print_info "Converting and setting permissions for create_admin_account.sh"
dos2unix /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
chmod +x /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
# endregion

# region SETTINGS
print_info "Copying settings to /etc/helyos"
cp -r demo/settings/config /etc/helyos/config
cp -r demo/settings/db_initial_data /etc/helyos/db_initial_data
cp -r demo/settings/rsa_keys /etc/helyos/.ssl_keys
print_info "Setting permissions for SSL keys"
chmod -R a-w,u+r /etc/helyos/.ssl_keys/*
# endregion

# region ENTRYPOINT FILES
print_info "Setting up entrypoint files"

print_info "Setting up wait-for-postgres.sh"
cp packaging/wait-for-postgres.sh /usr/local/helyos_core/bin/wait-for-postgres.sh
dos2unix /usr/local/helyos_core/bin/wait-for-postgres.sh
chmod +x /usr/local/helyos_core/bin/wait-for-postgres.sh

print_info "Setting up entrypoint.sh"
cp packaging/entrypoint.sh /usr/local/helyos_core/bin/entrypoint.sh
dos2unix /usr/local/helyos_core/bin/entrypoint.sh
chmod +x /usr/local/helyos_core/bin/entrypoint.sh
# endregion

print_info "Script completed successfully!"

echo "helyos_dashboard: /usr/local/helyos_core/helyos_dashboard"
echo "helyos_server: /usr/local/helyos_core/helyos_server"
echo "helyos_database: /usr/local/helyos_core/helyos_database"
echo "entrypoint files: /usr/local/helyos_core/bin"
echo "configuration files: /etc/helyos/config/"
echo "initial data files for the database: /etc/helyos/db_initial_data/"
echo "SSL keys: /etc/helyos/.ssl_keys"
