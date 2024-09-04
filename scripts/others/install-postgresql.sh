
version="16"

# Purge PostgreSQL, postgresql-client and postgresql-contrib
sudo apt-get --purge remove -y postgresql\*
sudo apt-get --purge remove -y postgresql-client\*
sudo apt-get --purge remove -y postgresql-contrib\*

# Remove PostgreSQL configuration, data, and log files
sudo rm -r /etc/postgresql/ || true
sudo rm -r /etc/postgresql-common/ || true
sudo rm -r /var/lib/postgresql/ || true
sudo rm -r /var/log/postgresql/ || true
sudo userdel -r postgres || true
sudo groupdel postgres || true

# Clean up unnecessary packages
sudo apt-get autoremove -y

# Verify removal
echo "Checking for remaining PostgreSQL processes..."
ps aux | grep postgres

echo "PostgreSQL removal complete."

# Update the package list
# sudo apt-get update

# Install PostgreSQL and postgresql-contrib
sudo apt-get install -y postgresql-$version postgresql-contrib-$version

psql --version