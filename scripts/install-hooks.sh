#!/bin/bash

set -e

HOOK_SRC="scripts/hooks/pre-commit"
HOOK_DEST=".git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "Error: $HOOK_SRC not found"
  exit 1
fi

ln -sf "../../$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_SRC"

echo "Git hooks installed successfully"

