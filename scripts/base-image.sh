#!/bin/bash

set -e

sudo apt-get -y  update
sudo apt-get install -y curl dos2unix

# Install Node.js 18
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get -y install nodejs

# Install PostgreSQL and postgresql-contrib
sudo apt-get install -y postgresql-client-16 postgresql-contrib-16

