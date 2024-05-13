# First stage
FROM node:18 AS dashboard_build

# ------------------- BUILDING THE DASHBOARD  -----------------------------
WORKDIR /usr/src/app
COPY helyos_dashboard/package.json /usr/src/app/package.json
COPY helyos_dashboard/package-lock.json /usr/src/app/package-lock.json
RUN npm set fetch-retry-maxtimeout 600000 && npm install --no-audit  --timeout=600000
COPY helyos_dashboard/ /usr/src/app
RUN npm run build --prod



# # Second stage
FROM helyosframework/helyos_core_base:2.0.1

# ------------------- BUILDING THE SERVER -----------------------------


# FOLDER STRUCTURE
WORKDIR /usr/local/helyos_core/helyos_server/
RUN mkdir -p /usr/local/helyos_core/helyos_server
RUN mkdir -p /usr/local/helyos_core/helyos_database
RUN mkdir -p /usr/local/helyos_core/helyos_dashboard
RUN mkdir -p /usr/local/helyos_core/bin
RUN mkdir -p /etc/helyos/config
RUN mkdir -p /etc/helyos/.ssl_keys
RUN mkdir -p /etc/helyos/db_initial_data

# NON ROOT USER    
RUN adduser --disabled-password --gecos '' helyosnonroot
RUN chown -R helyosnonroot:helyosnonroot /usr/local/helyos_core
RUN chown -R helyosnonroot:helyosnonroot /etc/helyos
USER helyosnonroot

# INSTALL HELYOS CORE DEPENDENCIES
ENV NODE_PATH=/usr/local/helyos_core/helyos_server/node_modules
COPY --chown=helyosnonroot  helyos_server/package.json  /usr/local/helyos_core/helyos_server/package.json
COPY --chown=helyosnonroot  helyos_server/package-lock.json  /usr/local/helyos_core/helyos_server/package-lock.json
RUN npm ci --omit=dev --timeout=600000

# HELYOS CORE SERVER FILES
COPY --chown=helyosnonroot helyos_server/ /usr/local/helyos_core/helyos_server
COPY --chown=helyosnonroot LICENSE.txt /usr/local/helyos_core/LICENSE.txt
COPY --chown=helyosnonroot --from=dashboard_build /usr/src/app/dist/ /usr/local/helyos_core/helyos_dashboard/dist/

# DATABASE
COPY --chown=helyosnonroot helyos_database/ /usr/local/helyos_core/helyos_database
RUN dos2unix /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
RUN chmod +x /usr/local/helyos_core/helyos_database/db_commands/migrate.sh
RUN dos2unix /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh
RUN chmod +x /usr/local/helyos_core/helyos_database/db_commands/create_admin_account.sh


# ENTRYPOINT FILES
COPY --chown=helyosnonroot packaging/wait-for-postgres.sh /usr/local/helyos_core/bin/wait-for-postgres.sh
RUN dos2unix /usr/local/helyos_core/bin/wait-for-postgres.sh
RUN chmod +x   /usr/local/helyos_core/bin/wait-for-postgres.sh 

COPY --chown=helyosnonroot packaging/entrypoint.sh   /usr/local/helyos_core/bin/entrypoint.sh
RUN dos2unix /usr/local/helyos_core/bin/entrypoint.sh
RUN chmod +x   /usr/local/helyos_core/bin/entrypoint.sh 


# ----------------- OPTIONALS ------------------------------

# REDOC API DOCUMENTATION - 
# Uncomment to generate redoc static api documentation instead of using swagger on the fly.
# RUN npm run make_map_api_doc
# RUN npm run make_path_api_doc

# SET INITIAL DB DATA WITHINGG THIS DOCKER IMAGE
# COPY --chown=helyosnonroot ./your_sql_folder/db_initial_data/   /etc/helyos/db_initial_data/

# CONVERT THE SOURCE CODE TO A SINGLE BINARY FILE AND DELETE THE SOURCE CODE
# RUN npm install -g pkg
# RUN pkg  --o /usr/local/helyos_core//helyos_server/helyos_core.app --targets node18-linuxstatic-x64 /usr/local/helyos_core/helyos_server/src/main.js 
# RUN chmod +x /usr/local/helyos_core/helyos_server/helyos_core.app
# RUN rm    -r /usr/local/helyos_core/helyos_server/src


# ------------------- START -----------------------
EXPOSE 5002
EXPOSE 5000
EXPOSE 8080

CMD [ "/usr/local/helyos_core/bin/wait-for-postgres.sh", "sh -c /usr/local/helyos_core/bin/entrypoint.sh"]



