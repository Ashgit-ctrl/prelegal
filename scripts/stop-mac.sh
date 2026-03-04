#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
echo "Stopping Prelegal..."
docker compose down
echo "Prelegal stopped."
