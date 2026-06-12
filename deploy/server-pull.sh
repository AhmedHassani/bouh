#!/usr/bin/env bash
#
# Runs every minute via cron.
#   1. git pull the repo (to pick up docker-compose or schema changes)
#   2. docker compose pull (to grab the latest image GitHub Actions built)
#   3. If anything changed, redeploy.
#
set -euo pipefail

APP_DIR="/opt/misahuh-bawh"
LOCK="/tmp/misahuh-pull.lock"

exec 9>"$LOCK" || exit 0
flock -n 9 || exit 0

cd "$APP_DIR"

# Sync repo (cheap)
git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
REPO_CHANGED=0
if [ "$LOCAL" != "$REMOTE" ]; then
  git reset --hard origin/main
  REPO_CHANGED=1
fi

# Pull the image
BEFORE=$(docker images --no-trunc --quiet ghcr.io/ahmedhassani/bouh-web:latest 2>/dev/null || true)
docker compose pull web 2>/dev/null
AFTER=$(docker images --no-trunc --quiet ghcr.io/ahmedhassani/bouh-web:latest 2>/dev/null || true)
IMAGE_CHANGED=0
[ "$BEFORE" != "$AFTER" ] && IMAGE_CHANGED=1

if [ "$REPO_CHANGED" = "1" ] || [ "$IMAGE_CHANGED" = "1" ]; then
  echo "════════ $(date -u +%FT%TZ) — deploying ════════"
  echo "  repo changed:  $REPO_CHANGED"
  echo "  image changed: $IMAGE_CHANGED"
  docker compose up -d --remove-orphans
  docker image prune -f >/dev/null 2>&1 || true
  echo "✓ Done"
fi
