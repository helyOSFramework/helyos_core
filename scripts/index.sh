#!/bin/bash

set -e

# Load environment variables from .env file
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
fi

current_dir=$(pwd)
working_dir=$current_dir/..
export working_dir

bash ./base-image.sh
bash ./helyos.sh
