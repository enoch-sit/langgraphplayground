#!/bin/bash
# wait-for-postgres.sh
# Script to wait for PostgreSQL to be ready before starting the application

set -e

# Use POSTGRES_HOST from environment variable or default to 'postgres'
host="${POSTGRES_HOST:-postgres}"

echo "Waiting for PostgreSQL at $host:${POSTGRES_PORT:-5432}..."

until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$host" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"
exec "$@"
