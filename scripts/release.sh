#!/bin/bash

set -e

LEVEL=${1:-patch}
PACKAGE_JSON="package.json"
ENV_FILE=".env"

echo -e "\033[1mReleasing zapid $LEVEL version\033[0m"
echo

if [[ "$LEVEL" != "patch" && "$LEVEL" != "minor" && "$LEVEL" != "major" ]]; then
  echo -e "\033[31mError: Invalid level '$LEVEL'. Must be 'patch', 'minor', or 'major'\033[0m"
  exit 1
fi

if [ ! -f "$PACKAGE_JSON" ]; then
  echo -e "\033[31mError: $PACKAGE_JSON not found\033[0m"
  exit 1
fi

echo -e "\033[1mExtracting current version\033[0m"
CURRENT_VERSION=$(grep '"version"' "$PACKAGE_JSON" | sed 's/.*"version": "\(.*\)".*/\1/')

if [ -z "$CURRENT_VERSION" ]; then
  echo -e "\033[31mError: Could not extract version from $PACKAGE_JSON\033[0m"
  exit 1
fi

echo "├─ Current version: $CURRENT_VERSION"

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case $LEVEL in
  major)
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
    NEW_PATCH=0
    ;;
  minor)
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
    ;;
  patch)
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$MINOR
    NEW_PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"
echo "└─ New version: $NEW_VERSION"
echo

echo -e "\033[1mUpdating version files\033[0m"

echo "├─ Updating $PACKAGE_JSON"
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"

if [ -f "$ENV_FILE" ]; then
  echo "├─ Updating $ENV_FILE"
else
  echo "├─ Creating $ENV_FILE"
fi

if grep -q "^ZAPID_VERSION=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s/^ZAPID_VERSION=.*/ZAPID_VERSION=$NEW_VERSION/" "$ENV_FILE"
else
  if [ -f "$ENV_FILE" ] && [ -n "$(tail -c1 "$ENV_FILE")" ]; then
    echo "" >> "$ENV_FILE"
  fi
  echo "ZAPID_VERSION=$NEW_VERSION" >> "$ENV_FILE"
fi

echo "└─ Set ZAPID_VERSION=$NEW_VERSION"
echo

echo -e "\033[1mBuilding Docker image\033[0m"
echo "├─ Building zapid:$NEW_VERSION"
docker compose build zapid > /dev/null 2>&1

echo "└─ Successfully built zapid:$NEW_VERSION"
echo

echo -e "\033[1mDone!\033[0m"
echo "Released version $NEW_VERSION"
echo "You can now run: docker compose up -d"
