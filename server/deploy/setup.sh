#!/usr/bin/env bash
# Installation initiale du serveur TLI Companion sur Debian 13 (à lancer une fois, en root).
# Usage : DOMAIN=tlicompanion.com bash setup.sh
set -euo pipefail

DOMAIN="${DOMAIN:?indique DOMAIN=ton.domaine}"
APP_DIR=/opt/tli-server
DATA_DIR=/var/lib/tli-server

echo "==> Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl ca-certificates gnupg ufw sqlite3 caddy

echo "==> Node.js 22 (NodeSource)"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
node --version

echo "==> Utilisateur et dossiers"
id tli >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin tli
mkdir -p "$APP_DIR" "$DATA_DIR/backups"
chown -R tli:tli "$DATA_DIR"
chmod 750 "$DATA_DIR"

echo "==> Service systemd"
cat > /etc/systemd/system/tli-server.service <<EOF
[Unit]
Description=TLI Companion community server
After=network.target

[Service]
User=tli
Group=tli
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=HOST=127.0.0.1
Environment=DATA_DIR=$DATA_DIR
Environment=NODE_NO_WARNINGS=1
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=3
# Durcissement
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

echo "==> Sauvegarde quotidienne de la base (14 jours gardés)"
cat > /etc/systemd/system/tli-backup.service <<EOF
[Unit]
Description=Sauvegarde base TLI Companion

[Service]
Type=oneshot
User=tli
ExecStart=/bin/sh -c 'sqlite3 $DATA_DIR/tli.db ".backup $DATA_DIR/backups/tli-\$(date +%%F).db" && find $DATA_DIR/backups -name "tli-*.db" -mtime +14 -delete'
EOF
cat > /etc/systemd/system/tli-backup.timer <<EOF
[Unit]
Description=Sauvegarde quotidienne TLI Companion

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo "==> Caddy (HTTPS automatique)"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:8080
	header Strict-Transport-Security "max-age=31536000"
}

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
EOF

echo "==> Pare-feu (SSH, HTTP, HTTPS)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl daemon-reload
systemctl enable tli-server tli-backup.timer caddy
systemctl start tli-backup.timer
systemctl reload caddy || systemctl restart caddy
echo "==> Terminé. Déploie le code avec deploy.ps1 puis : systemctl restart tli-server"
