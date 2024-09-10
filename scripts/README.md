# Installation and Usage

## Installation

1. **Navigate to the `scripts` Directory**  
   Change to the `scripts` directory:
   ```bash
   cd scripts
   ```

2. **Make the Install Script Executable**  
   Grant execute permissions to the `install.sh` script:
   ```bash
   chmod +x install.sh
   ```

3. **Install `helyos_core`**  
   Run the install script to install **helyos_core**:
   ```bash
   ./install.sh
   ```

4. **Installed Directories**  
   The installation directories will be located at:
   ```bash
   /usr/local/helyos_core/
   ```

5. **Paths**

   - **Core Components:**
     - **Dashboard**: `/usr/local/helyos_core/helyos_dashboard`
     - **Server**: `/usr/local/helyos_core/helyos_server`
     - **Database**: `/usr/local/helyos_core/helyos_database`
  
   - **Scripts and Binaries:**
     - **Entrypoint Files**: `/usr/local/helyos_core/bin`
  
   - **Configuration and Data:**
     - **Configuration Files**: `/etc/helyos/config/`
     - **Initial Database Data Files**: `/etc/helyos/db_initial_data/`
     - **SSL Keys**: `/etc/helyos/.ssl_keys`

## Running Instructions

1. **Navigate to the `scripts` Directory**  
   Change to the `scripts` directory:
   ```bash
   cd scripts
   ```

2. **Set Environment Variables**  
   Ensure the `.env` file is properly configured for your setup.

3. **Initial Setup or Migration**  
   Set `RUN_MODE` to `migration` for the initial setup or schema updates:
   ```bash
   export RUN_MODE=migration
   ```

4. **Production Mode**  
   For production, set `RUN_MODE` to `production`:
   ```bash
   export RUN_MODE=production
   ```

5. **Make the Startup Script Executable**  
   Grant execute permissions to the `start-helyos.sh` script:
   ```bash
   chmod +x start-helyos.sh
   ```

6. **Run the Startup Script**  
   Start **helyos_core** by running:
   ```bash
   ./start-helyos.sh
   ```

## Project Utilities

### `generate-redoc-doc.sh`

1. **Navigate to the `scripts` Directory**  
   Change to the `scripts` directory:
   ```bash
   cd scripts
   ```

2. **Make the Script Executable**  
   Grant execute permissions to the `generate-redoc-doc.sh` script:
   ```bash
   chmod +x generate-redoc-doc.sh
   ```

3. **Run the Script**  
   Generate static API documentation with:
   ```bash
   ./generate-redoc-doc.sh
   ```

### `source-to-bin.sh`

1. **Navigate to the `scripts` Directory**  
   Change to the `scripts` directory:
   ```bash
   cd scripts
   ```

2. **Make the Script Executable**  
   Grant execute permissions to the `source-to-bin.sh` script:
   ```bash
   chmod +x source-to-bin.sh
   ```

3. **Run the Script**  
   Convert source code to a binary file with:
   ```bash
   ./source-to-bin.sh
   ```