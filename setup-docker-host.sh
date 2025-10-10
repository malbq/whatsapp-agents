#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

STORAGE_DIR=/var/lib/zapid
CONTAINER_UID=1001
CONTAINER_GID=1001

echo -e "\033[1mSetting up Docker host storage for zapid\033[0m"
echo

echo -e "\033[1mCreating storage directory\033[0m"
if [ ! -d "$STORAGE_DIR" ]; then
  sudo mkdir -p "$STORAGE_DIR"
  echo "├─ Created $STORAGE_DIR"
else
  echo "├─ $STORAGE_DIR already exists"
fi

echo "├─ Setting ownership to container user (UID $CONTAINER_UID, GID $CONTAINER_GID)"
sudo chown -R "$CONTAINER_UID:$CONTAINER_GID" "$STORAGE_DIR"
sudo chmod 750 "$STORAGE_DIR"
echo "└─ Ownership and base permissions set"
echo

echo -e "\033[1mConfiguring ACLs for host user access\033[0m"
if command -v setfacl >/dev/null 2>&1; then
  echo "├─ Granting rwx access to user: $(whoami)"
  # Set permissions recursively for existing files
  sudo setfacl -R -m "u:$(whoami):rwx" "$STORAGE_DIR"
  # Set default permissions for new files
  sudo setfacl -d -m "u:$(whoami):rwx" "$STORAGE_DIR"
  echo "└─ ACLs configured (existing + default for new files)"
else
  echo -e "└─ \033[33msetfacl not found; skipping ACL setup\033[0m"
  echo "   You may need to install acl package or use sudo to access $STORAGE_DIR"
fi

echo
echo -e "\033[1mDone!\033[0m"
echo "You can now run: docker compose up --build"

