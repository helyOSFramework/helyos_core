#!/bin/bash

set -e

sudo apt-get -q update
sudo apt-get -yq install curl dos2unix

# Install Node.js 18
curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get -yq install nodejs

# Install PostgreSQL and postgresql-contrib
sudo apt-get -yq install postgresql-client-16 postgresql-contrib-16