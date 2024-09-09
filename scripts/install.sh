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
cd $working_dir

bash ./scripts/install-base-image.sh
bash ./scripts/install-helyos.sh
