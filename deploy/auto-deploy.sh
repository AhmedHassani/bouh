#!/usr/bin/env bash
#
# One-shot bootstrap for a fresh Ubuntu/Debian VPS.
# Installs Docker, clones the repo, starts the app, and sets up a cron job
# that pulls every minute and redeploys when there are new commits.
#
# Usage (paste once over SSH as root):
#   curl -fsSL https://raw.githubusercontent.com/AhmedHassani/bouh/main/deploy/auto-deploy.sh | bash
#
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/AhmedHassani/bouh.git}"
APP_DIR="/opt/misahuh-bawh"
ENV_SRC="/root/misahuh.env"
BRANCH="main"

echo "════════════════════════════════════════════════════════"
echo "  misahuh-bawh — auto-deploy bootstrap"
echo "════════════════════════════════════════════════════════"

# ─── 1. Install Docker + git ──────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installing Docker"
  apt-get update -y
  apt-get install -y ca-certificates curl git gnupg openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "✓ Docker already installed"
fi

command -v git >/dev/null 2>&1 || apt-get install -y git
command -v openssl >/dev/null 2>&1 || apt-get install -y openssl

# ─── 2. Clone repo ────────────────────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  echo "→ Cloning $REPO_URL"
  [ -d "$APP_DIR" ] && rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "✓ Repo already cloned"
fi

# ─── 3. Generate .env if missing ──────────────────────────────────────────────
if [ -f "$ENV_SRC" ]; then
  echo "→ Using $ENV_SRC"
  cp "$ENV_SRC" "$APP_DIR/.env"
elif [ ! -f "$APP_DIR/.env" ]; then
  echo "→ Generating default .env with random secrets"
  PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)
  JWT_A=$(openssl rand -base64 48 | tr -d '\n')
  JWT_R=$(openssl rand -base64 48 | tr -d '\n')
  JWT_G=$(openssl rand -base64 48 | tr -d '\n')
  cat > "$APP_DIR/.env" <<EOF
POSTGRES_USER=misahuh
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=misahuh
JWT_ACCESS_SECRET=$JWT_A
JWT_REFRESH_SECRET=$JWT_R
JWT_GUEST_SECRET=$JWT_G
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
EOF
  cp "$APP_DIR/.env" "$ENV_SRC"
  echo "  (saved a backup at $ENV_SRC)"
fi
chmod 600 "$APP_DIR/.env"

# ─── 4. First build + start ───────────────────────────────────────────────────
cd "$APP_DIR"
echo "→ Building and starting containers (first build ~3-5 min)"
docker compose up -d --build --remove-orphans

# ─── 5. Install the auto-update cron job ──────────────────────────────────────
UPDATE_SCRIPT="/usr/local/bin/misahuh-auto-update.sh"
echo "→ Installing $UPDATE_SCRIPT"
cp "$APP_DIR/deploy/auto-update.sh" "$UPDATE_SCRIPT"
chmod +x "$UPDATE_SCRIPT"

CRON_LINE="* * * * * $UPDATE_SCRIPT >> /var/log/misahuh-deploy.log 2>&1"
# Replace any existing entry, then add ours
( crontab -l 2>/dev/null | grep -v "misahuh-auto-update.sh" ; echo "$CRON_LINE" ) | crontab -
echo "✓ Cron installed — checks every minute, redeploys on new commits"

# ─── Done ────────────────────────────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✓ All set"
echo ""
echo "  Site:      http://$IP/"
echo "  Logs:      docker compose -f $APP_DIR/docker-compose.yml logs -f web"
echo "  Deploy log: tail -f /var/log/misahuh-deploy.log"
echo "  Env file:  $APP_DIR/.env  (also backed up at $ENV_SRC)"
echo "════════════════════════════════════════════════════════"
