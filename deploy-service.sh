#!/usr/bin/env bash
set -Eeuo pipefail

command -v bun >/dev/null || { echo "bun missing"; exit 1; }
command -v rsync >/dev/null || { echo "rsync missing"; exit 1; }

cd "$(dirname "$0")"

APP=zapid
DIR=/opt/$APP
SERVICE_FILE=/etc/systemd/system/$APP.service
SERVICE_INSTALLED=false
SERVICE_RUNNING=false

RUN_USER="$(id -un)"

echo -e "\033[1mStarting zapid deployment sync...\033[0m"
echo

echo -e "\033[1mSetting up system user\033[0m"
if id -u "$APP" >/dev/null 2>&1; then
  echo "└─ User '$APP' already exists"
else
  sudo useradd --system --no-create-home --shell /usr/sbin/nologin "$APP"
  echo "└─ Created system user '$APP'"
fi
echo

echo -e "\033[1mSetting up application directory structure\033[0m"
mkdir -p "$DIR"
echo "├─ Created application directory: $DIR"
echo

echo -e "\033[1mSyncing application files\033[0m"
sudo rsync -a --delete src/ "$DIR/src/"
sudo rsync -a package.json bun.lock "$DIR/"
echo "├─ Application files synchronized"
sudo install -d -m 750 "$DIR/storage"
echo "└─ Created storage directory with restricted permissions"
echo

echo -e "\033[1mConfiguring environment file\033[0m"
if [ -f .env ]; then
  if [ ! -f "$DIR/.env" ]; then
    sudo install -m 600 .env "$DIR/.env"
    echo "├─ Copied .env to target directory"
    sudo chown root:root "$DIR/.env"
    sudo chmod 600 "$DIR/.env"
    echo "└─ Environment file secured (root:root, 600)"
  else
    echo "└─ .env already exists in target; preserving existing file"
  fi
else
  echo -e "└─ \033[33m.env not found in source; skipping environment setup\033[0m"
fi
echo

echo -e "\033[1mInstalling dependencies\033[0m"
sudo chown -R "$RUN_USER:$RUN_USER" "$DIR"

if ! cmp -s bun.lock "$DIR/bun.lock" 2>/dev/null; then
  cd "$DIR"
  echo "├─ Installing/updating production dependencies..."
  bun install --production --frozen-lockfile
  echo "└─ Dependencies installed successfully"
  cd - >/dev/null
else
  echo "└─ Dependencies are up-to-date"
fi
echo

echo -e "\033[1mSetting secure file permissions\033[0m"
sudo chown -R "$APP:$APP" "$DIR"
echo "└─ File permissions set"
echo

echo -e "\033[1mConfiguring systemd service\033[0m"

if [ -f "$SERVICE_FILE" ]; then
  SERVICE_INSTALLED=true
  echo "├─ Service file exists at $SERVICE_FILE"
else
  echo "├─ Service file not found; will install new service"
fi

if systemctl is-active --quiet "$APP"; then
  SERVICE_RUNNING=true
  echo "├─ Service is currently running"
else
  echo "├─ Service is not running"
fi

RESTART_NEEDED=false
if ! cmp -s zapid.service "$SERVICE_FILE" 2>/dev/null; then
  echo "├─ Service configuration changed; updating..."
  sudo install -m 644 zapid.service "$SERVICE_FILE"
  sudo systemctl daemon-reload
  echo "└─ Service file updated and daemon reloaded"
  RESTART_NEEDED=true
else
  echo "└─ Service configuration is current"
fi

echo
echo -e "\033[1mManaging service lifecycle\033[0m"

if [ "$SERVICE_INSTALLED" = false ]; then
  echo "├─ Installing and starting new service..."
  sudo systemctl enable --now "$APP"
  echo "└─ Service installed and started successfully"
elif [ "$SERVICE_RUNNING" = true ] || [ "$RESTART_NEEDED" = true ]; then
  echo "├─ Restarting service..."
  sudo systemctl restart "$APP"
  echo "└─ Service restarted successfully"
else
  echo "├─ Starting service..."
  sudo systemctl start "$APP"
  echo "└─ Service started successfully"
fi

echo
echo -e "\033[1mDone!\033[0m"
