#!/bin/bash

set -e

source functions.sh

# Export all functions defined in functions.sh
export -f $(declare -F | awk '{print $3}')

current_dir=$(pwd)
working_dir=$current_dir/..
cd $working_dir

bash ./scripts/install-base-image.sh
bash ./scripts/install-helyos.sh
