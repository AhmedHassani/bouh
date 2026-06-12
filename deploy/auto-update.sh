#!/usr/bin/env bash
#
# Runs every minute via cron. Checks GitHub for new commits on main, and if
# there are any, pulls + rebuilds. Skips silently if nothing changed.
#
set -euo pipefail

APP_DIR="/opt/misahuh-bawh"
BRANCH="main"
LOCK="/tmp/misahuh-deploy.lock"

# Refuse to run in parallel
exec 9>"$LOCK" || exit 0
flock -n 9 || exit 0

cd "$APP_DIR"

# Fetch and compare
git fetch --quiet origin "$BRANCH"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "════════ $(date -u +%Y-%m-%dT%H:%M:%SZ) — new commit detected ════════"
echo "  from: $LOCAL"
echo "  to:   $REMOTE"

git reset --hard "origin/$BRANCH"

# Re-sync .env from /root/misahuh.env if present
if [ -f /root/misahuh.env ]; then
  cp /root/misahuh.env "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi

docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null 2>&1 || true

echo "✓ Deploy complete"
