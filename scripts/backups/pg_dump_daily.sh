#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${SUPABASE_DB_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/output}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "SUPABASE_DB_URL is required" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
DUMP_FILE="$BACKUP_DIR/truckinfox_${TIMESTAMP}.dump"

pg_dump --format=custom --no-owner --no-privileges --file "$DUMP_FILE" "$DATABASE_URL"

find "$BACKUP_DIR" -type f -name 'truckinfox_*.dump' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $DUMP_FILE"
echo "Retention cleanup done: files older than $RETENTION_DAYS days removed"
