#!/bin/bash

set -e

# Define color codes
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}### Updating package list...${NC}"
sudo apt-get -q update

echo -e "${GREEN}### Installing curl and dos2unix...${NC}"
sudo apt-get -yq install curl dos2unix

echo -e "${GREEN}### Installing Node.js 18...${NC}"
curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get -yq install nodejs

echo -e "${GREEN}### Installing PostgreSQL and postgresql-contrib...${NC}"
sudo apt-get -yq install postgresql-client-16 postgresql-contrib-16

echo -e "${GREEN}### All installations completed successfully.${NC}"
