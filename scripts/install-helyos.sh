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

reset_dir /usr/local/helyos_core
sudo cp LICENSE.txt /usr/local/helyos_core/LICENSE.txt

# region DASHBOARD
reset_dir /usr/src/app
sudo cp -r helyos_dashboard/* /usr/src/app
sudo npm ci --prefer-offline --no-audit --no-fund --prefix=/usr/src/app
sudo npm run build --prod --prefix=/usr/src/app
reset_dir /usr/local/helyos_core/helyos_dashboard/dist
sudo cp -r /usr/src/app/dist/* /usr/local/helyos_core/helyos_dashboard/dist
# endregion
delete_dir /usr/src/app

# region HELYOS CORE SERVER
reset_dir /usr/local/helyos_core/helyos_server
sudo cp -r helyos_server/* /usr/local/helyos_core/helyos_server
sudo npm ci --prefer-offline --no-audit --no-fund --prefix=/usr/local/helyos_core/helyos_server
# endregion

# region DATABASE
echo $PGHOST $PGPASSWORD $PGUSER $PGDATABASE $RUN_MODE
export PGHOST PGPASSWORD PGUSER PGDATABASE RUN_MODE

reset_dir /usr/local/helyos_core/helyos_database
sudo cp -r helyos_database/* /usr/local/helyos_core/helyos_database

sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
bash /usr/local/helyos_core/helyos_database/db_commands/migrate.sh

sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
bash /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
# endregion

# region SETTINGS
reset_dir /etc/helyos
sudo cp -r demo/settings/config /etc/helyos/config
sudo cp -r demo/settings/db_initial_data /etc/helyos/db_initial_data
sudo cp -r demo/settings/rsa_keys /etc/helyos/.ssl_keys
sudo chmod -R a-w,u+r /etc/helyos/.ssl_keys/*
# endregion

# region ENTRYPOINT FILES
reset_dir /usr/local/helyos_core/bin

sudo cp packaging/wait-for-postgres.sh /usr/local/helyos_core/bin/wait-for-postgres.sh
sudo dos2unix /usr/local/helyos_core/bin/wait-for-postgres.sh
sudo chmod +x /usr/local/helyos_core/bin/wait-for-postgres.sh
bash /usr/local/helyos_core/bin/wait-for-postgres.sh

sudo cp packaging/entrypoint.sh /usr/local/helyos_core/bin/entrypoint.sh
sudo dos2unix /usr/local/helyos_core/bin/entrypoint.sh
sudo chmod +x /usr/local/helyos_core/bin/entrypoint.sh
bash /usr/local/helyos_core/bin/entrypoint.sh
# endregion