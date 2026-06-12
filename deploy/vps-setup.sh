#!/usr/bin/env bash
#
# One-time VPS setup for misahuh-bawh.
# Run as root on a fresh Ubuntu/Debian VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/<OWNER>/<REPO>/main/deploy/vps-setup.sh | bash -s -- <git-url>
#   ── OR ──
#   bash vps-setup.sh git@github.com:<OWNER>/<REPO>.git
#
set -euo pipefail

GIT_URL="${1:-}"
APP_DIR="/opt/misahuh-bawh"

if [[ -z "$GIT_URL" ]]; then
  echo "Usage: $0 <git-clone-url>"
  exit 1
fi

echo "→ Updating apt"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "→ Installing prerequisites"
apt-get install -y ca-certificates curl git gnupg ufw

echo "→ Installing Docker (official repo)"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

echo "→ Configuring firewall (allow 22, 80, 443)"
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

echo "→ Cloning project to $APP_DIR"
mkdir -p "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$GIT_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull
fi

echo "→ Bootstrapping .env (if missing)"
if [[ ! -f "$APP_DIR/.env" ]]; then
  cat > "$APP_DIR/.env" <<'EOF'
# ─── Edit these BEFORE first deploy ──────────────────────────────────
POSTGRES_USER=misahuh
POSTGRES_PASSWORD=CHANGE_ME_LONG_RANDOM
POSTGRES_DB=misahuh

# JWT secrets — generate with: openssl rand -base64 48
JWT_ACCESS_SECRET=CHANGE_ME
JWT_REFRESH_SECRET=CHANGE_ME
JWT_GUEST_SECRET=CHANGE_ME

# Pusher (realtime)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

# Optional: ZainCash, Firebase, etc.
EOF
  echo "  → Edit /opt/misahuh-bawh/.env before first deploy"
fi

echo ""
echo "✓ VPS setup done."
echo "  Next steps:"
echo "    1. nano $APP_DIR/.env   # fill in the secrets"
echo "    2. cd $APP_DIR && docker compose up -d --build"
echo "    3. (later) GitHub Actions deploys handle it automatically"
