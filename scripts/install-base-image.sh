#!/bin/bash

set -e

# Define color codes
GREEN='\033[0;32m'
NC='\033[0m' # No Color

print() {
    echo -e "\n${GREEN}### $1...${NC}"
}

print "Updating package list"
sudo apt-get -q update

print "Installing curl and dos2unix"
sudo apt-get -yq install curl dos2unix

print "Installing Node.js 18"
curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get -yq install nodejs

print "Installing PostgreSQL and postgresql-contrib"
sudo apt-get -yq install postgresql-client-16 postgresql-contrib-16

print "All installations completed successfully"
