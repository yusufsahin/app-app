#!/bin/sh
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Verifying database schema..."
python scripts/docker_verify_schema.py
echo "Starting application..."
exec uvicorn alm.main:create_app --factory --host 0.0.0.0 --port 8000
