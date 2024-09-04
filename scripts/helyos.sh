#!/bin/bash

# reset dir func
set -e

reset_dir() {
    local dir=$1
    
    [ -d $dir ] && sudo rm -rf $dir
    sudo mkdir -p $dir
}

helyos_database=$working_dir/helyos_database
helyos_dashboard=$working_dir/helyos_dashboard
helyos_server=$working_dir/helyos_server
helyos_license=$working_dir/LICENSE.txt

demo_settings=$working_dir/demo/settings
demo_settings_config=$demo_settings/config
demo_settings_db_initial_data=$demo_settings/db_initial_data
demo_settings_rsa_keys=$demo_settings/rsa_keys

packaging=$working_dir/packaging
packaging_postgres=$packaging/wait-for-postgres.sh
packaging_entrypoint=$packaging/entrypoint.sh

usr_src_app=/usr/src/app
usr_src_app_dist=$usr_src_app/dist
usr_local_helyos_core=/usr/local/helyos_core

usr_local_helyos_bin=$usr_local_helyos_core/bin
usr_local_helyos_bin_postgres=$usr_local_helyos_bin/wait-for-postgres.sh
usr_local_helyos_bin_entrypoint=$usr_local_helyos_bin/entrypoint.sh

# fix these folders paths
usr_local_helyos_database=$usr_local_helyos_core/helyos_database
usr_local_helyos_server=$usr_local_helyos_core/helyos_server
usr_local_helyos_dashboard_dist=$usr_local_helyos_core/helyos_dashboard/dist
usr_local_helyos_license=$usr_local_helyos_core/LICENSE.txt

etc_helyos=/etc/helyos
etc_helyos_config=$etc_helyos/config
etc_helyos_db_initial_data=$etc_helyos/db_initial_data
etc_helyos_ssl_keys=$etc_helyos/.ssl_keys

reset_dir $usr_local_helyos_core

# DASHBOARD
reset_dir $usr_src_app
sudo cp -r $helyos_dashboard/* $usr_src_app
cd $usr_src_app
sudo npm set fetch-retry-maxtimeout 600000 && sudo npm install --no-audit --timeout=600000
sudo npm run build --prod
reset_dir $usr_local_helyos_dashboard_dist
sudo cp -r $usr_src_app_dist/* $usr_local_helyos_dashboard_dist

sudo cp $helyos_license $usr_local_helyos_license

# HELYOS CORE SERVER
reset_dir $usr_local_helyos_server
sudo cp -r $helyos_server/* $usr_local_helyos_server
cd $usr_local_helyos_server
sudo npm ci --omit=dev --timeout=600000

echo $PGHOST $PGPASSWORD $PGUSER $PGDATABASE $RUN_MODE
export PGHOST PGPASSWORD PGUSER PGDATABASE RUN_MODE

# DATABASE
reset_dir $usr_local_helyos_database
sudo cp -r $helyos_database/* $usr_local_helyos_database

sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
bash /usr/local/helyos_core/helyos_database/db_commands/migrate.sh

sudo dos2unix /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
sudo chmod +x /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
bash /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh

# SETTINGS
reset_dir $etc_helyos
sudo cp -r $demo_settings_config $etc_helyos_config
sudo cp -r $demo_settings_db_initial_data $etc_helyos_db_initial_data
sudo cp -r $demo_settings_rsa_keys $etc_helyos_ssl_keys
sudo chmod -R a-w,u+r $etc_helyos_ssl_keys/*

# ENTRYPOINT FILES

reset_dir $usr_local_helyos_bin

sudo cp $packaging_postgres $usr_local_helyos_bin_postgres
sudo dos2unix $usr_local_helyos_bin_postgres
sudo chmod +x $usr_local_helyos_bin_postgres
bash $usr_local_helyos_bin_postgres

sudo cp $packaging_entrypoint $usr_local_helyos_bin_entrypoint
sudo dos2unix $usr_local_helyos_bin_entrypoint
sudo chmod +x $usr_local_helyos_bin_entrypoint
bash $usr_local_helyos_bin_entrypoint