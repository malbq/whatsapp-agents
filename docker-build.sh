#!/bin/bash

set -e

VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "Error: Could not extract version from package.json"
  exit 1
fi

echo "Building and deploying Docker image with version: $VERSION"

# Update docker-compose.yml with the current version
sed -i "s/image: zapid:.*/image: zapid:$VERSION/" docker-compose.yml

export VERSION
docker compose build

echo "Successfully deployed zapid:$VERSION"

