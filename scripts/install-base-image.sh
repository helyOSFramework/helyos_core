#!/bin/bash

set -e

print_info "Updating package list"
sudo apt-get -q update

print_info "Installing curl and dos2unix"
sudo apt-get -yq install curl dos2unix

print_info "Installing Node.js 18"
curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get -yq install nodejs

print_info "Installing PostgreSQL and postgresql-contrib"
sudo apt-get -yq install postgresql-client-16 postgresql-contrib-16

print_info "All installations completed successfully"
