
### Installation and Setup Instructions

1. **Navigate to the `scripts` directory**  
   Ensure you're in the `scripts` directory. If you're not, navigate there by running:
   ```bash
   cd scripts
   ```

2. **Make the install script executable**  
   To grant execute permissions to the install script, run the following command:
   ```bash
   chmod +x install.sh
   ```

3. **Install `helyos_core`**  
   Execute the install script to install **helyos_core**:
   ```bash
   ./install.sh
   ```

4. **Installed Directories**  
   After installation, the directories will be located at:
   ```bash
   /usr/local/helyos_core/
   ```

5. **Paths**

   - **Core Components**:
     - **Dashboard**: `/usr/local/helyos_core/helyos_dashboard`
     - **Server**: `/usr/local/helyos_core/helyos_server`
     - **Database**: `/usr/local/helyos_core/helyos_database`
  
   - **Scripts and Binaries**:
     - **Entrypoint Files**: `/usr/local/helyos_core/bin`
  
   - **Configuration and Data**:
     - **Configuration Files**: `/etc/helyos/config/`
     - **Initial Database Data Files**: `/etc/helyos/db_initial_data/`
     - **SSL Keys**: `/etc/helyos/.ssl_keys`

---

### Running Instructions

1. **Navigate to the `scripts` directory**  
   Ensure you're in the `scripts` directory. If you're not, navigate there by running:
   ```bash
   cd scripts
   ```

2. **Set Environment Variables**  
   The environment variables are defined in the `.env` file. Make sure this file is properly configured for your setup.

3. **Set RUN_MODE for Initial Setup or Migration**  
   On the first run or when updating the schema, set the `RUN_MODE` environment variable to `migration` to perform pre-migration data updates, update the schema database (files in `/usr/local/helyos_core/helyos_database/db_schema/*`), and execute post-migration data updates. You can set the variable by running:
   ```bash
   RUN_MODE=migration
   ```

4. **Set RUN_MODE for Production**  
   For subsequent runs, change the `RUN_MODE` environment variable to `production`. This ensures the application runs in production mode. You can set the variable by running:
   ```bash
   RUN_MODE=production
   ```

5. **Make the Startup Script Executable**  
   To grant execute permissions to the startup script, run:
   ```bash
   chmod +x start-helyos.sh
   ```

6. **Run the Script**  
   Execute the start script to start **helyos_core**:
   ```bash
   ./start-helyos.sh
   ```

---