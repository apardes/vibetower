#!/bin/bash
set -euo pipefail

# ─── Require root ────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo "Error: must run as root (sudo ./deploy.sh)"
    exit 1
fi

# ─── Interactive prompts ─────────────────────────────────────────────────────
read -rp "Domain name (e.g. example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "Error: domain name is required"
    exit 1
fi

read -rp "Email for SSL certificate (Let's Encrypt): " EMAIL
if [ -z "$EMAIL" ]; then
    echo "Error: email is required"
    exit 1
fi

REPO_DIR="$(pwd)"
echo ""
echo "Configuration:"
echo "  Domain:    $DOMAIN"
echo "  Email:     $EMAIL"
echo "  Site root: $REPO_DIR"
echo ""
read -rp "Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# ─── Install packages ────────────────────────────────────────────────────────
echo ""
echo "==> Installing packages..."
apt update
apt install -y nginx certbot python3-certbot-nginx fail2ban unattended-upgrades

# ─── Firewall ────────────────────────────────────────────────────────────────
echo ""
echo "==> Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ─── Unattended upgrades ─────────────────────────────────────────────────────
echo ""
echo "==> Enabling unattended upgrades..."
dpkg-reconfigure -f noninteractive unattended-upgrades

# ─── fail2ban ─────────────────────────────────────────────────────────────────
echo ""
echo "==> Enabling fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# ─── Nginx config ────────────────────────────────────────────────────────────
echo ""
echo "==> Writing nginx config..."
cat > "/etc/nginx/sites-available/$DOMAIN" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    root $REPO_DIR;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/html application/javascript text/css;
    gzip_min_length 256;

    # HTML — always revalidate
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # JS modules — always revalidate, ETags make it fast (304 if unchanged)
    location /src/ {
        add_header Cache-Control "no-cache";
        etag on;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

# Enable site, remove default
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default

# Validate config
echo "==> Testing nginx config..."
nginx -t

# ─── Start nginx (needed for certbot) ────────────────────────────────────────
echo ""
echo "==> Starting nginx..."
systemctl enable nginx
systemctl restart nginx

# ─── SSL certificate ─────────────────────────────────────────────────────────
echo ""
echo "==> Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "==> Done! Site is live at https://$DOMAIN"
echo ""
echo "To deploy updates, just git pull from this directory."
echo "Certbot auto-renewal is handled by a systemd timer."
