#!/bin/bash
set -e

echo "Starting database initialization..."

# Wait for MongoDB to be ready
until mongosh --host localhost --eval "print('Connected successfully')"; do
  echo "Waiting for MongoDB to start..."
  sleep 2
done

# Verbose restoration
mongorestore --verbose --host localhost --db ZenDB /dump/ZenDB

if [ $? -eq 0 ]; then
  echo "Database restoration successful"
else
  echo "Database restoration failed"
  exit 1
fi