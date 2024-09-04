#!/bin/bash

set -e

current_dir=$(pwd)
working_dir=$current_dir/..
demo_dir=$working_dir/demo
containers="local_postgres local_rabbitmq"

cd $demo_dir

docker compose down -v
docker compose build $containers
docker compose up --no-deps --build $containers

