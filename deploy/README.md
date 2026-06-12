# Deployment — VPS + GitHub Actions (zero-touch)

Push to `main` → GitHub Actions logs in to the VPS by password → installs Docker if missing → pulls the repo → writes `.env` → `docker compose up -d --build`.

You don't have to log in to the server manually.

---

## Setup — just add 5 GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret         | Value                                                        |
|----------------|--------------------------------------------------------------|
| `VPS_HOST`     | `13.140.177.108`                                             |
| `VPS_USER`     | `root`                                                       |
| `VPS_PASSWORD` | the (rotated) root password                                  |
| `REPO_URL`     | `https://github.com/<OWNER>/<REPO>.git` (public) or with PAT |
| `ENV_FILE`     | full `.env` contents (multiline) — see below                 |

### What goes in `ENV_FILE`

Paste the whole file as a single multiline secret. Example:

```env
POSTGRES_USER=misahuh
POSTGRES_PASSWORD=a-long-random-password
POSTGRES_DB=misahuh

JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
JWT_GUEST_SECRET=<openssl rand -base64 48>

PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=...
NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=...
```

GitHub treats the whole blob as one secret; the workflow writes it verbatim to `/opt/misahuh-bawh/.env`.

### Private repo?

If your GitHub repo is private, generate a fine-grained PAT (`repo: read-only`) and use:

```
REPO_URL=https://oauth2:<PAT>@github.com/<OWNER>/<REPO>.git
```

---

## Deploy

Push to `main` (or **Actions** → **Deploy to VPS** → **Run workflow**). First run takes ~5 min (Docker install + initial build). Subsequent runs ~30–90 s.

Verify: `http://13.140.177.108/`

---

## Operations (run from your laptop via the same SSH password)

```bash
ssh root@13.140.177.108

# Logs
cd /opt/misahuh-bawh
docker compose logs -f web
docker compose logs -f db

# Restart
docker compose restart web

# Postgres backup
docker compose exec db pg_dump -U misahuh misahuh > /root/backup-$(date +%F).sql

# Manual prisma migrate
docker compose exec web sh -c "cd /app/packages/db && npx prisma migrate deploy"
```

---

## Security note — switching to SSH key later (recommended)

Password auth is convenient but weaker. When you're ready:

1. On your laptop: `ssh-keygen -t ed25519 -f ~/.ssh/misahuh_deploy -N ""`
2. Copy the public key to the VPS: `ssh-copy-id -i ~/.ssh/misahuh_deploy.pub root@13.140.177.108`
3. In GitHub, replace `VPS_PASSWORD` with `VPS_SSH_KEY` (paste the private key contents).
4. In `.github/workflows/deploy.yml`, change `password:` to `key:`.

Done in ~2 minutes.

---

## Adding HTTPS later (when you have a domain)

Add a Caddy container in front of `web`:

```yaml
# docker-compose.yml — additions
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on: [web]

volumes:
  caddy-data:
  caddy-config:
```

```caddy
# Caddyfile
yourdomain.com {
    reverse_proxy web:3000
}
```

Then remove the `"80:3000"` port mapping from the `web` service and `docker compose up -d`. Let's Encrypt cert is issued automatically.

---

## Troubleshooting

| Symptom                                          | Fix                                                                 |
|--------------------------------------------------|---------------------------------------------------------------------|
| Action: `ssh: handshake failed`                  | Wrong `VPS_PASSWORD` or VPS blocks password auth — check `/etc/ssh/sshd_config`. |
| `docker: command not found` (first run only)     | Install step ran but PATH not refreshed — re-run workflow. |
| `pnpm install` fails in build                    | Lockfile drift. Run `pnpm install` locally, commit `pnpm-lock.yaml`. |
| `prisma migrate deploy` fails                    | Schema has unapplied migrations. SSH in and run `docker compose exec web sh -c "cd /app/packages/db && npx prisma migrate deploy"` manually. |
| App returns 500 on `/api/trpc/*`                 | `ENV_FILE` secret missing keys — check `docker compose logs web`. |
| Container restart loop                           | `docker compose logs web --tail=200` — usually a missing env var.   |
