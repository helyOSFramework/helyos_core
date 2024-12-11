# helyOS Core Installation and Management Scripts

This directory contains scripts to help install **helyOS Core** on a bare Debian-compatible system without Docker. These steps have been tested on **Ubuntu 20.04.6 LTS**.

## 1. Installation

Run the `install.sh` script to install **helyOS Core**.
```bash
./install.sh
```

The following components will be installed in `/usr/local/helyos_core/`:
- **helyos_dashboard**
- **helyos_server**
- **helyos_database**

> 💡 **Note:** This process will install **Node.js 18** on your machine.

## 2. Before Start

Before running **helyOS Core**, ensure that the environment variables are correctly set in the `.env` file. 

The full list of environment variables and their descriptions can be found in the official documentation: [helyOS Configuration - Getting Started](https://helyos-manual.readthedocs.io/en/latest/2-helyos-configuration/getting-started.html).

Run the migration process once to set up the database schema:
```bash
/usr/local/helyos_core/helyos_database/db_commands/migrate.sh
```

## 3. Running Instructions

- **Start**: Run the startup script using `start-helyos.sh`:
  ```bash
  ./start-helyos.sh
  ```

- **Stop**: To stop the helyOS Core, use the `stop-helyos.sh` script:
  ```bash
  ./stop-helyos.sh
  ```

## 4. Configuration and Data:

helyOS Core relies on several configuration files to define its behavior.

- **Configuration Files**: `/etc/helyos/config/`
- **Initial Database Data Files**: `/etc/helyos/db_initial_data/`
- **SSL Keys**: `/etc/helyos/.ssl_keys`

## 5. Project Utilities

### Documentation

This script generates static API documentation. Run the following command to create the documentation:
```bash
./generate-redoc-doc.sh
```

### Binary

Use this script to convert the source code into a binary format. Run the following command:
```bash
./source-to-bin.sh
```

Use this script to run the binary. Run the following command:
```bash
./start-bin.sh
```