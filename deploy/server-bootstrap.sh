#!/usr/bin/env bash
#
# One-shot bootstrap for the VPS. After this runs, the server self-updates
# every minute by pulling the latest GHCR image + restarting compose.
#
# Run as root on the VPS:
#   curl -fsSL https://raw.githubusercontent.com/AhmedHassani/bouh/main/deploy/server-bootstrap.sh | bash
#
set -euo pipefail

APP_DIR="/opt/misahuh-bawh"
REPO_URL="https://github.com/AhmedHassani/bouh.git"
PULL_SCRIPT="/usr/local/bin/misahuh-pull.sh"

echo "→ Installing Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg openssl git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

command -v git >/dev/null 2>&1 || apt-get install -y git
command -v openssl >/dev/null 2>&1 || apt-get install -y openssl

echo "→ Cloning/updating repo"
if [ ! -d "$APP_DIR/.git" ]; then
  [ -d "$APP_DIR" ] && rm -rf "$APP_DIR"
  git clone --depth=1 --branch main "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
fi
cd "$APP_DIR"

echo "→ Generating .env (if missing)"
if [ ! -f .env ]; then
  PG=$(openssl rand -base64 24 | tr -d /+= | cut -c1-32)
  A=$(openssl rand -base64 48 | tr -d '\n')
  R=$(openssl rand -base64 48 | tr -d '\n')
  G=$(openssl rand -base64 48 | tr -d '\n')
  {
    echo "POSTGRES_USER=misahuh"
    echo "POSTGRES_PASSWORD=$PG"
    echo "POSTGRES_DB=misahuh"
    echo "JWT_ACCESS_SECRET=$A"
    echo "JWT_REFRESH_SECRET=$R"
    echo "JWT_GUEST_SECRET=$G"
    echo "PUSHER_APP_ID="
    echo "PUSHER_KEY="
    echo "PUSHER_SECRET="
    echo "PUSHER_CLUSTER="
    echo "NEXT_PUBLIC_PUSHER_KEY="
    echo "NEXT_PUBLIC_PUSHER_CLUSTER="
  } > .env
  chmod 600 .env
fi

echo "→ Installing $PULL_SCRIPT"
cp "$APP_DIR/deploy/server-pull.sh" "$PULL_SCRIPT"
chmod +x "$PULL_SCRIPT"

echo "→ Installing cron job (runs every minute)"
CRON="* * * * * $PULL_SCRIPT >> /var/log/misahuh-deploy.log 2>&1"
( crontab -l 2>/dev/null | grep -v misahuh-pull.sh ; echo "$CRON" ) | crontab -

echo "→ First pull + start"
"$PULL_SCRIPT"

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✓ Done — http://$IP/"
echo "  Logs:      docker compose -f $APP_DIR/docker-compose.yml logs -f web"
echo "  Deploy log: tail -f /var/log/misahuh-deploy.log"
