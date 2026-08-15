#!/usr/bin/env bash
# Cloudflare named tunnel for local HTTPS dev over trafijs.com.
#
#   https://pekulo-dev.trafijs.com  ->  http://localhost:3002   (apps/web  — Next.js)
#   https://bridge-dev.trafijs.com  ->  http://localhost:3005   (apps/api  — Elysia)
#
# Why: PWA install / Service Worker (story 9-x) and Bridge webhooks + OAuth
# (story 5-6, ADR-0015) need a real public HTTPS origin. A named tunnel gives
# STABLE hostnames (vs `--url` quick tunnels that regenerate on every restart).
# Bridge webhook endpoint (set in dashboard.bridgeapi.io):
#   https://bridge-dev.trafijs.com/internal/bridge/webhook
#
# ONE-TIME (interactive, do it yourself in a real terminal):
#   cloudflared tunnel login        # authorize the trafijs.com zone -> ~/.cloudflared/cert.pem
#
# Then run this script (idempotent): creates/reuses the tunnel, (re)writes the
# ingress config, and routes DNS for both hostnames. Finally:
#   cloudflared tunnel run pekulo-dev
set -euo pipefail

TUNNEL="pekulo-dev"
ZONE="trafijs.com"
WEB_HOST="pekulo-dev.${ZONE}"
API_HOST="bridge-dev.${ZONE}"
WEB_PORT="${WEB_PORT:-3002}"
API_PORT="${API_PORT:-3005}"   # apps/api PORT in the repo root .env (Zod default is 3001)
CF_DIR="${HOME}/.cloudflared"
CONFIG="${CF_DIR}/config.yml"

command -v cloudflared >/dev/null 2>&1 || { echo "❌ cloudflared not installed — run: brew install cloudflared"; exit 1; }
[ -f "${CF_DIR}/cert.pem" ] || { echo "❌ Not authenticated. Run once in your terminal: cloudflared tunnel login"; exit 1; }

tunnel_uuid() { cloudflared tunnel list 2>/dev/null | awk -v n="${TUNNEL}" '$2==n {print $1}'; }

UUID="$(tunnel_uuid || true)"
if [ -z "${UUID}" ]; then
  echo "▶ creating tunnel ${TUNNEL}…"
  cloudflared tunnel create "${TUNNEL}"
  UUID="$(tunnel_uuid)"
elif [ ! -f "${CF_DIR}/${UUID}.json" ]; then
  # Tunnel exists in the account (e.g. from story 6-10) but its local
  # credentials file is gone — it can't be run. Recreate it (no active
  # connections on a dev tunnel), DNS is re-pointed below.
  echo "⚠ ${TUNNEL} exists but ${UUID}.json is missing locally — recreating…"
  cloudflared tunnel delete -f "${TUNNEL}"
  cloudflared tunnel create "${TUNNEL}"
  UUID="$(tunnel_uuid)"
fi

CRED="${CF_DIR}/${UUID}.json"
[ -f "${CRED}" ] || { echo "❌ credentials ${CRED} not found after create"; exit 1; }

echo "▶ writing ${CONFIG} (tunnel ${UUID})"
cat > "${CONFIG}" <<YAML
tunnel: ${UUID}
credentials-file: ${CRED}

ingress:
  - hostname: ${WEB_HOST}
    service: http://localhost:${WEB_PORT}
  - hostname: ${API_HOST}
    service: http://localhost:${API_PORT}
  - service: http_status:404
YAML

echo "▶ routing DNS (CNAME -> ${UUID}.cfargotunnel.com)"
cloudflared tunnel route dns --overwrite-dns "${TUNNEL}" "${WEB_HOST}"
cloudflared tunnel route dns --overwrite-dns "${TUNNEL}" "${API_HOST}"

cat <<DONE

✅ Tunnel ready.
   ${WEB_HOST}  -> localhost:${WEB_PORT}
   ${API_HOST}  -> localhost:${API_PORT}

Start it (leave running alongside \`bun run dev\`):
   cloudflared tunnel run ${TUNNEL}
DONE
