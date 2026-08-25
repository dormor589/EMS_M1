#!/bin/bash
# Seed the database inside a running compose stack.
#
#   docker compose up -d
#   ./scripts/docker-seed.sh
#
# Separate from startup on purpose: seeding truncates every table, so it must
# be a deliberate act rather than something that happens on every restart.
set -e
docker compose exec api node src/db/migrate.js
docker compose exec api node src/db/seed.js
echo
echo "Seeded. Log in at http://localhost:5173"
echo "  teacher@ems.dev / password"
echo "  student@ems.dev / password"
