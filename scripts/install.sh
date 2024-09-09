#!/bin/bash

set -e

current_dir=$(pwd)
working_dir=$current_dir/..
cd $working_dir

bash ./scripts/install-base-image.sh
bash ./scripts/install-helyos.sh
