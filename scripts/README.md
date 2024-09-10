
### Installation and Setup Instructions

1. **Navigate to the `scripts` directory**  
   Ensure you're in the `scripts` directory. If you're not, navigate there by running:
   ```bash
   cd scripts
   ```

2. **Make the install file executable**  
   To grant execute permissions to the install file, run the following command:
   ```bash
   chmod +x install.sh
   ```

3. **Install `helyos_core`**  
   Execute the install file to install **helyos_core**:
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