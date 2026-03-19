#!/bin/sh
set -eu

mkdir -p /app/data/sqlite /app/data/prototypes /app/data/uploads-temp

exec "$@"

