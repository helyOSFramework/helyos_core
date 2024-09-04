#!/bin/bash

# reset dir func
set -e

reset_dir() {
    local dir=$1
    
    [ -d $dir ] && sudo rm -rf $dir
    sudo mkdir -p $dir
}

reset_dir /usr/local/helyos_core

# DASHBOARD
reset_dir /usr/src/app
sudo cp -r helyos_dashboard/* /usr/src/app
sudo npm set fetch-retry-maxtimeout 600000 && sudo npm install --no-audit --timeout=600000 --prefix=/usr/src/app
sudo npm run build --prod --prefix=/usr/src/app
reset_dir /usr/local/helyos_core/helyos_dashboard/dist
sudo cp -r /usr/src/app/dist/* /usr/local/helyos_core/helyos_dashboard/dist

sudo cp LICENSE.txt /usr/local/helyos_core/LICENSE.txt

# HELYOS CORE SERVER
reset_dir /usr/local/helyos_core/helyos_server
sudo cp -r helyos_server/* /usr/local/helyos_core/helyos_server
sudo npm ci --omit=dev --timeout=600000 --prefix=/usr/local/helyos_core/helyos_server

echo $PGHOST $PGPASSWORD $PGUSER $PGDATABASE $RUN_MODE
export PGHOST PGPASSWORD PGUSER PGDATABASE RUN_MODE

# DATABASE
reset_dir /usr/local/helyos_core/helyos_database
sudo cp -r helyos_database/* /usr/local/helyos_core/helyos_database

sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
bash /usr/local/helyos_core/helyos_database/db_commands/migrate.sh

sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
bash /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh

# SETTINGS
reset_dir /etc/helyos
sudo cp -r demo/settings/config /etc/helyos/config
sudo cp -r demo/settings/db_initial_data /etc/helyos/db_initial_data
sudo cp -r demo/settings/rsa_keys /etc/helyos/.ssl_keys
sudo chmod -R a-w,u+r /etc/helyos/.ssl_keys/*

# ENTRYPOINT FILES

reset_dir /usr/local/helyos_core/bin

sudo cp packaging/wait-for-postgres.sh /usr/local/helyos_core/bin/wait-for-postgres.sh
sudo dos2unix /usr/local/helyos_core/bin/wait-for-postgres.sh
sudo chmod +x /usr/local/helyos_core/bin/wait-for-postgres.sh
bash /usr/local/helyos_core/bin/wait-for-postgres.sh

sudo cp packaging/entrypoint.sh /usr/local/helyos_core/bin/entrypoint.sh
sudo dos2unix /usr/local/helyos_core/bin/entrypoint.sh
sudo chmod +x /usr/local/helyos_core/bin/entrypoint.sh
bash /usr/local/helyos_core/bin/entrypoint.sh