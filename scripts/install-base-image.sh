#!/bin/bash

set -e

print_success "Updating package list"
sudo apt-get -q update

print_success "Installing curl and dos2unix"
sudo apt-get -yq install curl dos2unix

print_success "Installing Node.js 18"
curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get -yq install nodejs

print_success "Installing PostgreSQL and postgresql-contrib"
sudo apt-get -yq install postgresql-client-16 postgresql-contrib-16

print_success "All installations completed successfully"
