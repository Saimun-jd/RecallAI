#!/bin/sh
# =============================================================================
# Recall AI — Docker Container Entrypoint
# Executes database readiness checks, applies pending schema migrations,
# and starts the ASGI application server with proper signal handling.
# =============================================================================
set -e

echo "[Recall AI Entrypoint] Initializing production container runtime..."

# 1. Ensure persistent storage directories exist
mkdir -p "${DATA_DIR:-/app/data}" "${UPLOAD_DIR:-/app/uploads}" 2>/dev/null || true

# 2. Run schema initialization & migration tracker
echo "[Recall AI Entrypoint] Synchronizing database schema and migrations..."
python -c "
import sys
try:
    from app.core.migrations import run_migrations, get_migration_status
    applied = run_migrations()
    status = get_migration_status()
    print(f'[Recall AI Entrypoint] Migrations OK: {status.get(\"status\")} ({status.get(\"total_applied\")} applied, {len(applied)} new)')
except Exception as e:
    print(f'[Recall AI Entrypoint] Non-fatal migration check warning: {e}', file=sys.stderr)
"

# 3. Hand off to container CMD with exec so signals (SIGTERM, SIGINT) go to the application
echo "[Recall AI Entrypoint] Handing off to process: $@"
exec "$@"
